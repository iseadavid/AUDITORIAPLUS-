/**
 * MaraPlus On-Premise Relay Agent
 * -------------------------------------------------------------
 * Bridges Supabase Cloud with the physical on-premise MaraPlus API (192.168.15.225:3002).
 * 
 * Core Features:
 * - Realtime WebSocket subscription to Supabase `Relay_Queue` table for INSERT (Status = 'Pending').
 * - In-memory FIFO queue with cursor-based processing.
 * - Dynamic RateLimitDelayMs synchronization from `Read_Admin_Control_Panel` (range 200ms - 2000ms, default 300ms).
 * - Strict Anti-Saturation:
 *     - Inter-request throttle: RateLimitDelayMs between calls.
 *     - Strict Batch Counter: Processes max 10 consecutive requests.
 *     - Mandatory Batch Cooldown: Exactly 2000ms pause after every 10 requests before taking the next 10 items.
 * - Updates Supabase row with Status = 'Completed' and payload (stock_quantity, ventas_dia, precio_base, impuesto_porcentaje).
 * - Automatic startup recovery of orphaned 'Pending' jobs.
 * - Robust error handling with timeout protection & graceful SIGTERM/SIGINT shutdown.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// 1. CONFIGURATION & ENVIRONMENT VALIDATION
// ============================================================================
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const MARAPLUS_BASE_URL = process.env.MARAPLUS_BASE_URL || 'http://192.168.15.225:3002';
const MARAPLUS_TIMEOUT_MS = parseInt(process.env.MARAPLUS_TIMEOUT_MS || '7000', 10);
const AGENT_INSTANCE_ID = process.env.AGENT_INSTANCE_ID || `agent-${process.pid}-${Date.now().toString(36)}`;

// Anti-saturation constants as strictly specified
const BATCH_SIZE_LIMIT = 10;
const MANDATORY_BATCH_COOLDOWN_MS = 2000;
const MIN_RATE_LIMIT_DELAY_MS = 200;
const MAX_RATE_LIMIT_DELAY_MS = 2000;
const DEFAULT_RATE_LIMIT_DELAY_MS = 300;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[FATAL CONFIG] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables.');
  process.exit(1);
}

// ============================================================================
// 2. LOGGING UTILITY
// ============================================================================
const log = {
  info: (msg, meta = {}) => console.log(`[${new Date().toISOString()}] [INFO] [${AGENT_INSTANCE_ID}] ${msg}`, Object.keys(meta).length ? JSON.stringify(meta) : ''),
  warn: (msg, meta = {}) => console.warn(`[${new Date().toISOString()}] [WARN] [${AGENT_INSTANCE_ID}] ${msg}`, Object.keys(meta).length ? JSON.stringify(meta) : ''),
  error: (msg, meta = {}) => console.error(`[${new Date().toISOString()}] [ERROR] [${AGENT_INSTANCE_ID}] ${msg}`, Object.keys(meta).length ? JSON.stringify(meta) : ''),
  debug: (msg, meta = {}) => {
    if (process.env.DEBUG === 'true') {
      console.log(`[${new Date().toISOString()}] [DEBUG] [${AGENT_INSTANCE_ID}] ${msg}`, Object.keys(meta).length ? JSON.stringify(meta) : '');
    }
  }
};

// ============================================================================
// 3. SUPABASE CLIENT INITIALIZATION
// ============================================================================
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  },
  realtime: {
    params: {
      eventsPerSecond: 50
    }
  }
});

// ============================================================================
// 4. IN-MEMORY STATE & FIFO CURSOR ENGINE
// ============================================================================
class RelayFifoQueue {
  constructor() {
    this.queue = [];
    this.enqueuedSet = new Set();
    this.isWorkerRunning = false;
    this.consecutiveBatchCount = 0;
    this.cachedRateLimitDelayMs = DEFAULT_RATE_LIMIT_DELAY_MS;
    this.lastControlPanelSync = 0;
    this.isShuttingDown = false;
  }

  /**
   * Add new item to the end of FIFO queue (rejects duplicates already in queue)
   */
  enqueue(item) {
    if (!item || !item.id) return;
    
    if (this.enqueuedSet.has(item.id)) {
      log.debug(`Item #${item.id} already exists in FIFO queue. Skipping duplicate enqueue.`);
      return;
    }

    this.enqueuedSet.add(item.id);
    this.queue.push(item);
    log.info(`Enqueued job #${item.id} [SKU: ${item.SkuCode || 'N/A'}, Deposito: ${item.DepositCode || 'N/A'}]. Queue Depth: ${this.queue.length}`);

    // Trigger processing if worker is currently idle
    this.triggerWorker();
  }

  /**
   * Helper to trigger the background consumer loop
   */
  triggerWorker() {
    if (!this.isWorkerRunning && !this.isShuttingDown && this.queue.length > 0) {
      this.isWorkerRunning = true;
      this.processQueueLoop()
        .catch(err => log.error('Unhandled exception inside processQueueLoop:', { error: err.message }))
        .finally(() => {
          this.isWorkerRunning = false;
          // Re-check if items arrived while loop was concluding
          if (this.queue.length > 0 && !this.isShuttingDown) {
            this.triggerWorker();
          }
        });
    }
  }

  /**
   * Query & clamp RateLimitDelayMs from Read_Admin_Control_Panel
   * Valid range: 200ms - 2000ms. Default: 300ms.
   */
  async fetchDynamicRateLimitDelay() {
    const now = Date.now();
    // Cache for 3 seconds to avoid hammering the control table on each item
    if (now - this.lastControlPanelSync < 3000) {
      return this.cachedRateLimitDelayMs;
    }

    try {
      const { data, error } = await supabase
        .from('Read_Admin_Control_Panel')
        .select('RateLimitDelayMs')
        .limit(1)
        .maybeSingle();

      if (error) {
        log.warn(`Could not read Read_Admin_Control_Panel: ${error.message}. Retaining cached delay ${this.cachedRateLimitDelayMs}ms.`);
        this.lastControlPanelSync = now;
        return this.cachedRateLimitDelayMs;
      }

      if (data && data.RateLimitDelayMs !== null && data.RateLimitDelayMs !== undefined) {
        const parsed = parseInt(data.RateLimitDelayMs, 10);
        if (!isNaN(parsed)) {
          // Strict clamping between 200ms and 2000ms
          const clamped = Math.max(MIN_RATE_LIMIT_DELAY_MS, Math.min(MAX_RATE_LIMIT_DELAY_MS, parsed));
          if (clamped !== this.cachedRateLimitDelayMs) {
            log.info(`Control Panel update: RateLimitDelayMs changed from ${this.cachedRateLimitDelayMs}ms to ${clamped}ms (raw: ${data.RateLimitDelayMs})`);
          }
          this.cachedRateLimitDelayMs = clamped;
        }
      }
      this.lastControlPanelSync = now;
    } catch (err) {
      log.warn(`Failed reading RateLimitDelayMs from Supabase: ${err.message}. Using ${this.cachedRateLimitDelayMs}ms.`);
      this.lastControlPanelSync = now;
    }

    return this.cachedRateLimitDelayMs;
  }

  /**
   * Update cached delay directly from Realtime subscription payload
   */
  setCachedDelay(newDelay) {
    const parsed = parseInt(newDelay, 10);
    if (!isNaN(parsed)) {
      const clamped = Math.max(MIN_RATE_LIMIT_DELAY_MS, Math.min(MAX_RATE_LIMIT_DELAY_MS, parsed));
      log.info(`Realtime Sync: RateLimitDelayMs updated immediately to ${clamped}ms`);
      this.cachedRateLimitDelayMs = clamped;
      this.lastControlPanelSync = Date.now();
    }
  }

  /**
   * Core FIFO Consumer Loop enforcing Strict Anti-Saturation
   */
  async processQueueLoop() {
    log.debug(`Worker loop engaged. Active queue length: ${this.queue.length}`);

    while (this.queue.length > 0 && !this.isShuttingDown) {
      // 1. Shift next item from head of FIFO cursor
      const item = this.queue.shift();
      this.enqueuedSet.delete(item.id);

      const batchPosition = this.consecutiveBatchCount + 1;
      log.info(`[BATCH ${batchPosition}/${BATCH_SIZE_LIMIT}] Processing Job #${item.id} [SKU: ${item.SkuCode}, Deposito: ${item.DepositCode}]`);

      // 2. Fetch current dynamic RateLimitDelayMs from control panel
      const currentRateLimitDelay = await this.fetchDynamicRateLimitDelay();

      // 3. Dispatch to physical MaraPlus API and synchronize back to Supabase
      const processStartTime = Date.now();
      await this.executeJobWithMaraPlus(item);
      const executionElapsed = Date.now() - processStartTime;

      // 4. Increment consecutive batch count
      this.consecutiveBatchCount++;

      // 5. Anti-Saturation Rules Execution:
      // Case A: Batch of 10 completed -> Mandatory 2000 ms pause before taking next 10 items
      if (this.consecutiveBatchCount >= BATCH_SIZE_LIMIT) {
        log.info(`[ANTI-SATURATION] Completed batch of ${BATCH_SIZE_LIMIT} requests. Entering mandatory cooldown of ${MANDATORY_BATCH_COOLDOWN_MS}ms...`);
        
        // Exact user requirement: await new Promise(r => setTimeout(r, 2000))
        await new Promise(r => setTimeout(r, MANDATORY_BATCH_COOLDOWN_MS));

        this.consecutiveBatchCount = 0; // Reset batch counter
        log.info(`[ANTI-SATURATION] Mandatory cooldown of ${MANDATORY_BATCH_COOLDOWN_MS}ms completed. Ready for next batch. Remaining queue: ${this.queue.length}`);
      } else {
        // Case B: Between individual items within the batch -> wait RateLimitDelayMs
        if (this.queue.length > 0) {
          log.debug(`[RATE-LIMIT] Applying inter-request delay: ${currentRateLimitDelay}ms (Job #${item.id} execution took ${executionElapsed}ms)`);
          await new Promise(r => setTimeout(r, currentRateLimitDelay));
        }
      }
    }

    log.debug(`Worker loop finished current backlog. Idle state.`);
  }

  /**
   * Sends GET request to MaraPlus local API and writes back payload to Supabase
   */
  async executeJobWithMaraPlus(job) {
    const skuCode = job.SkuCode || '';
    const depositCode = job.DepositCode || '';

    // Construct exact target URL:
    // http://192.168.15.225:3002/api/inventory?search={SkuCode}&deposito={DepositCode}&onlyOffers=false
    const url = new URL('/api/inventory', MARAPLUS_BASE_URL);
    url.searchParams.set('search', skuCode);
    url.searchParams.set('deposito', depositCode);
    url.searchParams.set('onlyOffers', 'false');

    const requestUrlString = url.toString();
    log.info(`Dispatching HTTP GET -> ${requestUrlString}`);

    // Set row to 'Processing' in Supabase to signal lock and progress
    try {
      await supabase
        .from('Relay_Queue')
        .update({
          Status: 'Processing',
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id)
        .eq('Status', 'Pending');
    } catch (dbErr) {
      log.warn(`Could not set Job #${job.id} to Processing status: ${dbErr.message}`);
    }

    // Abort controller for timeout safety on physical network
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), MARAPLUS_TIMEOUT_MS);

    try {
      const response = await fetch(requestUrlString, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': `MaraPlus-RelayAgent/${AGENT_INSTANCE_ID}`
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`MaraPlus API returned HTTP ${response.status}: ${response.statusText}`);
      }

      const rawJson = await response.json();
      log.debug(`MaraPlus API Response for Job #${job.id}:`, { raw: rawJson });

      // Extract required response fields:
      // Normalize whether MaraPlus returns an array [item], single object, or wrapped { data: ... }
      const itemRecord = Array.isArray(rawJson) 
        ? rawJson[0] 
        : (rawJson?.data && typeof rawJson.data === 'object' ? (Array.isArray(rawJson.data) ? rawJson.data[0] : rawJson.data) : rawJson);

      const stock_quantity = Number(itemRecord?.stock_quantity ?? itemRecord?.stock ?? itemRecord?.existencia ?? 0);
      const ventas_dia = Number(itemRecord?.ventas_dia ?? itemRecord?.ventas ?? itemRecord?.daily_sales ?? 0);
      const precio_base = Number(itemRecord?.precio_base ?? itemRecord?.precio ?? itemRecord?.base_price ?? 0);
      const impuesto_porcentaje = Number(itemRecord?.impuesto_porcentaje ?? itemRecord?.iva ?? itemRecord?.tax_percentage ?? 0);

      // Return of Response:
      // Update row in Relay_Queue changing Status = 'Completed' and saving extracted payload
      const { error: updateError } = await supabase
        .from('Relay_Queue')
        .update({
          Status: 'Completed',
          stock_quantity: stock_quantity,
          ventas_dia: ventas_dia,
          precio_base: precio_base,
          impuesto_porcentaje: impuesto_porcentaje,
          response_payload: rawJson,
          error_message: null,
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id);

      if (updateError) {
        log.error(`Supabase DB update failed for Job #${job.id}: ${updateError.message}`);
      } else {
        log.info(`[COMPLETED] Job #${job.id} -> SKU: ${skuCode} | Stock: ${stock_quantity} | Ventas Día: ${ventas_dia} | Precio Base: $${precio_base} | Impuesto: ${impuesto_porcentaje}%`);
      }

    } catch (err) {
      clearTimeout(timeoutId);
      const isTimeout = err.name === 'AbortError';
      const errorMessage = isTimeout 
        ? `MaraPlus API connection timeout after ${MARAPLUS_TIMEOUT_MS}ms contacting ${MARAPLUS_BASE_URL}`
        : `MaraPlus API request failed: ${err.message}`;

      log.error(`[FAILURE] Job #${job.id}: ${errorMessage}`);

      // Record failure state in Supabase so the queue does not deadlock
      try {
        await supabase
          .from('Relay_Queue')
          .update({
            Status: 'Failed',
            error_message: errorMessage,
            updated_at: new Date().toISOString()
          })
          .eq('id', job.id);
      } catch (dbErr) {
        log.error(`Failed to update Job #${job.id} to Failed status: ${dbErr.message}`);
      }
    }
  }

  shutdown() {
    this.isShuttingDown = true;
    log.info('Relay Queue worker shutdown initiated. Halting new jobs.');
  }
}

// Instantiate global relay FIFO engine
const relayQueue = new RelayFifoQueue();

// ============================================================================
// 5. BOOTSTRAP: RECOVER PENDING JOBS FROM DB
// ============================================================================
async function recoverPendingJobsFromDatabase() {
  log.info('Running startup recovery: checking for unhandled Pending jobs in Relay_Queue...');
  try {
    const { data, error } = await supabase
      .from('Relay_Queue')
      .select('*')
      .eq('Status', 'Pending')
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) {
      log.error(`Failed to query startup pending jobs: ${error.message}`);
      return;
    }

    if (data && data.length > 0) {
      log.info(`Recovered ${data.length} pending jobs from Supabase database. Loading into FIFO queue...`);
      for (const row of data) {
        relayQueue.enqueue(row);
      }
    } else {
      log.info('No pending jobs found on startup. Relay queue is clear.');
    }
  } catch (err) {
    log.error(`Startup recovery error: ${err.message}`);
  }
}

// ============================================================================
// 6. REALTIME WEBSOCKET SUBSCRIPTIONS
// ============================================================================
let relayChannel = null;
let controlChannel = null;

function setupRealtimeSubscriptions() {
  log.info('Initializing Supabase Realtime WebSocket subscriptions...');

  // 1. Subscribe to INSERT on Relay_Queue where Status = 'Pending'
  relayChannel = supabase
    .channel('relay_queue_realtime_channel')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'Relay_Queue',
        filter: 'Status=eq.Pending'
      },
      (payload) => {
        log.info(`[REALTIME-INSERT] Received new Pending job #${payload.new?.id} via WebSocket.`);
        relayQueue.enqueue(payload.new);
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'Relay_Queue',
        filter: 'Status=eq.Pending'
      },
      (payload) => {
        // Also catch re-queued items marked back to Pending
        log.info(`[REALTIME-UPDATE] Detected job #${payload.new?.id} re-queued to Pending.`);
        relayQueue.enqueue(payload.new);
      }
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        log.info('Successfully subscribed to Supabase Realtime channel for Relay_Queue (Status=Pending)');
      } else if (status === 'CHANNEL_ERROR') {
        log.error(`Realtime Relay_Queue channel error: ${err?.message || 'Unknown'}`);
      } else if (status === 'TIMED_OUT') {
        log.warn('Realtime Relay_Queue channel subscription timed out. Reconnecting...');
      }
    });

  // 2. Subscribe to Read_Admin_Control_Panel for instant RateLimitDelayMs synchronization
  controlChannel = supabase
    .channel('admin_control_panel_realtime_channel')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'Read_Admin_Control_Panel'
      },
      (payload) => {
        if (payload.new && payload.new.RateLimitDelayMs !== undefined) {
          log.info(`[CONTROL-PANEL-EVENT] Detected RateLimitDelayMs change: ${payload.new.RateLimitDelayMs}ms`);
          relayQueue.setCachedDelay(payload.new.RateLimitDelayMs);
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        log.info('Successfully subscribed to Supabase Realtime channel for Read_Admin_Control_Panel');
      }
    });
}

// ============================================================================
// 7. AGENT LIFECYCLE & GRACEFUL SHUTDOWN
// ============================================================================
async function startAgent() {
  console.log('=================================================================');
  console.log('       MARAPLUS ON-PREMISE RELAY AGENT (NODE.JS / DOCKER)        ');
  console.log('=================================================================');
  log.info(`Agent Instance: ${AGENT_INSTANCE_ID}`);
  log.info(`Supabase Endpoint: ${SUPABASE_URL}`);
  log.info(`MaraPlus Physical API: ${MARAPLUS_BASE_URL}`);
  log.info(`Batch Size Limit: ${BATCH_SIZE_LIMIT} requests`);
  log.info(`Mandatory Cooldown: ${MANDATORY_BATCH_COOLDOWN_MS}ms`);
  log.info(`Rate Limit Clamp: [${MIN_RATE_LIMIT_DELAY_MS}ms .. ${MAX_RATE_LIMIT_DELAY_MS}ms], Default: ${DEFAULT_RATE_LIMIT_DELAY_MS}ms`);

  // Initial Control Panel Delay Fetch
  await relayQueue.fetchDynamicRateLimitDelay();

  // Startup Catch-up from DB
  await recoverPendingJobsFromDatabase();

  // Start Realtime WebSockets
  setupRealtimeSubscriptions();

  log.info('MaraPlus Relay Agent is active and listening for incoming queue items.');
}

async function handleShutdown(signal) {
  log.warn(`Received ${signal}. Starting graceful shutdown...`);
  relayQueue.shutdown();

  if (relayChannel) {
    try {
      await supabase.removeChannel(relayChannel);
      log.info('Closed Realtime Relay_Queue channel.');
    } catch (e) {
      log.error('Error closing Relay_Queue channel:', { error: e.message });
    }
  }

  if (controlChannel) {
    try {
      await supabase.removeChannel(controlChannel);
      log.info('Closed Realtime Read_Admin_Control_Panel channel.');
    } catch (e) {
      log.error('Error closing control channel:', { error: e.message });
    }
  }

  log.info('MaraPlus Relay Agent safely terminated.');
  process.exit(0);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  log.error('Uncaught Exception in process:', { error: err.message, stack: err.stack });
});
process.on('unhandledRejection', (reason) => {
  log.error('Unhandled Promise Rejection:', { reason });
});

// Launch Agent
startAgent();
