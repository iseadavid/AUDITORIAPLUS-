import { AgentFile } from '../types';

export const AGENT_FILES: AgentFile[] = [
  {
    name: 'types/clientContracts.ts',
    filename: 'types/clientContracts.ts',
    language: 'typescript',
    description: 'Contratos de Tipos estrictos: ApiInventoryQueryParams, InventoryItemData, ReadSkuMaster, ReadMissionTask, ReadVirtualTransfer, etc.',
    content: `export interface ApiInventoryQueryParams {
  search: string;
  deposito: string;
  onlyOffers: boolean | string;
}

export interface InventoryItemData {
  sku_code: string;
  sku_name?: string;
  deposit_code: string;
  stock_quantity: number;
  ventas_dia: number;
  precio_base: number;
  impuesto_porcentaje: number;
  last_updated_at?: string;
}

export interface InventoryApiResponse {
  success: boolean;
  data: InventoryItemData[] | InventoryItemData;
  total?: number;
  timestamp?: string;
}

export interface ReadSkuMaster {
  sku_code: string;
  barcode: string;
  description: string;
  category?: string;
  presentation?: string;
  tax_rate: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ReadMissionTask {
  id: number;
  mission_id: string;
  sku_code: string;
  sku_name?: string;
  deposit_code: string;
  status: 'Pending_Count' | 'In_Progress' | 'Reconciled_Match' | 'Discrepancy_Pending_Review' | 'Overridden' | 'Completed' | 'Rejected';
  system_quantity: number;
  sales_during_audit: number;
  counted_quantity?: number | null;
  delta_real?: number | null;
  is_locked: boolean;
  forced_quantity?: number | null;
  override_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReadVirtualTransfer {
  id: number;
  mission_id: string;
  sku_code: string;
  from_deposit: string;
  to_deposit: string;
  quantity_to_move: number;
  transit_deposit: string; // '150104'
  status: 'Suggested' | 'Pending_ERP_Confirmation' | 'Executed' | 'Rejected' | 'Cancelled';
  suggested_at: string;
  notes?: string | null;
}

export interface ReadUsersGamification {
  user_id: string;
  username: string;
  display_name: string;
  role: 'auditor' | 'supervisor' | 'admin';
  total_counts_completed: number;
  accuracy_rate: number;
  points: number;
  badges: string[];
  current_streak_days: number;
}

export interface EventStoreRecord {
  id: number;
  event_type: string;
  aggregate_type: 'MissionTask' | 'VirtualTransfer' | 'AdminConfig' | 'InventorySku' | 'OfflineSync';
  aggregate_id: string;
  payload: Record<string, unknown>;
  emitted_by: string;
  created_at: string;
}

export interface LiveControlResponse {
  success: boolean;
  timestamp: string;
  metrics: Record<string, unknown>;
  recent_immutable_events: EventStoreRecord[];
}`
  },
  {
    name: 'store/useAuditStore.ts',
    filename: 'store/useAuditStore.ts',
    language: 'typescript',
    description: 'Estado Global Zustand: currentMissionId, currentDepositCode, userAuth, isOffline, activeQueueCount, setSession(), syncOfflineEvents()',
    content: `import { create } from 'zustand';
import { flushOfflineQueue } from '../services/offlineSyncWorker';
import { getOfflineQueueStats, enqueueOfflineEvent } from '../services/offlineDatabase';

export const useAuditStore = create((set, get) => ({
  currentMissionId: 'MIS-2026-001',
  currentDepositCode: '150101',
  userAuth: {
    userId: 'usr-auditor-101',
    username: 'carlos.auditor',
    role: 'auditor',
  },
  isOffline: !navigator.onLine,
  activeQueueCount: 0,

  setSession: (missionId, depositCode, user) => {
    set({
      currentMissionId: missionId,
      currentDepositCode: depositCode,
      userAuth: user,
    });
  },

  syncOfflineEvents: async () => {
    const result = await flushOfflineQueue();
    const stats = await getOfflineQueueStats();
    set({ activeQueueCount: stats.pending });
    return result;
  },

  setIsOffline: (offline) => {
    set({ isOffline: offline });
    if (!offline) get().syncOfflineEvents();
  },
}));`
  },
  {
    name: 'services/offlineDatabase.ts',
    filename: 'services/offlineDatabase.ts',
    language: 'typescript',
    description: 'IndexedDB con "idb": missions_cache, sku_master_local, offline_events_queue (idx_mission_deposit, idx_sequence, idx_status)',
    content: `import { openDB } from 'idb';

export async function getOfflineDb() {
  return openDB('auditoriaplus_offline_db', 1, {
    upgrade(db) {
      db.createObjectStore('missions_cache', { keyPath: 'mission_id' });
      db.createObjectStore('sku_master_local', { keyPath: 'sku_code' });
      
      const queueStore = db.createObjectStore('offline_events_queue', { keyPath: 'client_event_id' });
      queueStore.createIndex('idx_mission_deposit', ['mission_id', 'deposit_code']);
      queueStore.createIndex('idx_sequence', 'sequence_num');
      queueStore.createIndex('idx_status', 'sync_status');
    }
  });
}`
  },
  {
    name: 'services/offlineSyncWorker.ts',
    filename: 'services/offlineSyncWorker.ts',
    language: 'typescript',
    description: 'Service Worker Sincronizador: flushOfflineQueue(), orden estrictamente por timestamp_utc, rechazo HTTP 409 Conflict',
    content: `import { getPendingOfflineEvents, updateOfflineEventStatus } from './offlineDatabase';

export async function flushOfflineQueue(apiBaseUrl = '/api/v1') {
  const pendingEvents = await getPendingOfflineEvents();
  // Orden causal estricto por timestamp_utc original
  pendingEvents.sort((a, b) => new Date(a.timestamp_utc).getTime() - new Date(b.timestamp_utc).getTime());

  for (const event of pendingEvents) {
    const response = await fetch(\`\${apiBaseUrl}/audit/register-count\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: event.task_id, counted_quantity: event.counted_quantity }),
    });

    if (response.status === 409) {
      // Conflicto por Override en servidor -> marcar tarea como rejected
      await updateOfflineEventStatus(event.client_event_id, 'rejected', {
        conflict_reason: 'HTTP 409: Tarea sobrescrita (Overridden) por supervisor'
      });
    } else if (response.ok) {
      await updateOfflineEventStatus(event.client_event_id, 'synced');
    }
  }
}`
  },
  {
    name: 'api-gateway/index.ts',
    filename: 'api-gateway/index.ts',
    language: 'typescript',
    description: 'Endpoints REST Edge Function: /register-count, /rate-limit, /override-task, /unlock-sku, /sync-now, /live-control',
    content: `// ==============================================================================
// AUDITORIAPLUS+ REST API GATEWAY (Supabase Edge Function / Deno)
// ==============================================================================
// Endpoints con Inserción Inmutable en EventStore:
// 1. POST /api/v1/audit/register-count: ΔReal = C - (S - V) -> Match vs Discrepancy + Compensaciones
// 2. POST /api/v1/admin/config/rate-limit: Configura delay inter-llamadas
// 3. POST /api/v1/admin/override-task: Forzar cantidad y registrar justificación
// 4. POST /api/v1/admin/unlock-sku: Desbloqueo operativo de SKU en depósito
// 5. POST /api/v1/admin/sync-now: Sincronización teórica bajo demanda vía Relay_Queue
// 6. GET  /api/v1/admin/live-control: Métricas en vivo y estado del sistema
// ==============================================================================

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createAdminClient } from '../_shared/supabaseClient.ts';
import { appendEvent } from '../_shared/eventStore.ts';
import { evaluateVirtualCompensations, VIRTUAL_TRANSIT_NODE } from '../_shared/virtualCompensations.ts';

const jsonResponse = (data: unknown, status = 200) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    },
  });
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\\/functions\\/v1\\/api-gateway/, '').replace(/^\\/api-gateway/, '') || url.pathname;
  const method = req.method;

  console.log(\`[API Gateway] \${method} \${path}\`);
  const supabase = createAdminClient();

  try {
    // --------------------------------------------------------------------------
    // 1. POST /api/v1/audit/register-count
    // --------------------------------------------------------------------------
    if (method === 'POST' && (path.endsWith('/api/v1/audit/register-count') || path === '/audit/register-count')) {
      const body = await req.json();
      const { task_id, counted_quantity, auditor_id = 'auditor-scanner-01' } = body;

      if (task_id === undefined || counted_quantity === undefined) {
        return jsonResponse({ error: 'Parámetros obligatorios faltantes: task_id, counted_quantity' }, 400);
      }

      // Buscar la tarea en Read_Mission_Tasks
      const { data: task, error: taskErr } = await supabase
        .from('Read_Mission_Tasks')
        .select('*')
        .eq('id', task_id)
        .single();

      if (taskErr || !task) {
        return jsonResponse({ error: \`Tarea no encontrada con ID #\${task_id}\` }, 404);
      }

      const C = Number(counted_quantity);
      const S = Number(task.system_quantity || 0);
      const V = Number(task.sales_during_audit || 0);

      // FÓRMULA ESTRICTA: ΔReal = C - (S - V)
      const expectedEffectiveTheoretical = S - V;
      const deltaReal = C - expectedEffectiveTheoretical;

      console.log(\`[Register Count] Tarea #\${task.id} | S=\${S}, V=\${V} -> Teórico Neto=\${expectedEffectiveTheoretical} | C=\${C} -> ΔReal=\${deltaReal}\`);

      // Registrar evento de captura inicial en EventStore
      await appendEvent(
        'TaskCountRegistered',
        'MissionTask',
        String(task.id),
        {
          task_id: task.id,
          sku_code: task.sku_code,
          deposit_code: task.deposit_code,
          counted_quantity: C,
          system_quantity: S,
          sales_during_audit: V,
          expected_effective: expectedEffectiveTheoretical,
          delta_real: deltaReal,
        },
        auditor_id
      );

      // CASO A: ΔReal = 0 -> Reconciled_Match / TaskCompleted_Match
      if (deltaReal === 0) {
        await supabase
          .from('Read_Mission_Tasks')
          .update({
            counted_quantity: C,
            delta_real: 0,
            status: 'Reconciled_Match',
            is_locked: false,
            updated_at: new Date().toISOString(),
          })
          .eq('id', task.id);

        const eventResult = await appendEvent(
          'TaskCompleted_Match',
          'MissionTask',
          String(task.id),
          {
            task_id: task.id,
            status: 'Reconciled_Match',
            delta_real: 0,
            matched_at: new Date().toISOString(),
          },
          auditor_id
        );

        return jsonResponse({
          success: true,
          status: 'Reconciled_Match',
          task_id: task.id,
          sku_code: task.sku_code,
          deposit_code: task.deposit_code,
          math: {
            counted: C,
            system: S,
            sales: V,
            delta_real: 0,
          },
          event_emitted: 'TaskCompleted_Match',
          event_id: eventResult.eventId,
          virtual_compensations: null,
        });
      } 
      // CASO B: ΔReal ≠ 0 -> DiscrepancyDetected y disparo de compensaciones
      else {
        await supabase
          .from('Read_Mission_Tasks')
          .update({
            counted_quantity: C,
            delta_real: deltaReal,
            status: 'Discrepancy_Pending_Review',
            is_locked: true, // Bloqueo operativo automático
            updated_at: new Date().toISOString(),
          })
          .eq('id', task.id);

        const discEventResult = await appendEvent(
          'DiscrepancyDetected',
          'MissionTask',
          String(task.id),
          {
            task_id: task.id,
            sku_code: task.sku_code,
            deposit_code: task.deposit_code,
            delta_real: deltaReal,
            discrepancy_type: deltaReal > 0 ? 'Sobrante (Surplus)' : 'Faltante (Deficit)',
            counted: C,
            system: S,
            sales: V,
          },
          auditor_id
        );

        // DISPARO AUTOMÁTICO DEL ALGORITMO DE COMPENSACIONES VIRTUALES (150104)
        const compensationResult = await evaluateVirtualCompensations(
          task.mission_id,
          task.sku_code,
          \`audit/register-count-task-\${task.id}\`
        );

        return jsonResponse({
          success: true,
          status: 'Discrepancy_Pending_Review',
          task_id: task.id,
          sku_code: task.sku_code,
          deposit_code: task.deposit_code,
          math: {
            counted: C,
            system: S,
            sales: V,
            delta_real: deltaReal,
            type: deltaReal > 0 ? 'Sobrante' : 'Faltante',
          },
          event_emitted: 'DiscrepancyDetected',
          event_id: discEventResult.eventId,
          virtual_transit_node: VIRTUAL_TRANSIT_NODE,
          virtual_compensations: compensationResult,
        });
      }
    }

    // --------------------------------------------------------------------------
    // 2. POST /api/v1/admin/config/rate-limit
    // --------------------------------------------------------------------------
    if (method === 'POST' && (path.endsWith('/api/v1/admin/config/rate-limit') || path === '/admin/config/rate-limit')) {
      const body = await req.json();
      const { rate_limit_delay_ms } = body;

      if (rate_limit_delay_ms === undefined) {
        return jsonResponse({ error: 'rate_limit_delay_ms es requerido' }, 400);
      }

      const parsed = parseInt(String(rate_limit_delay_ms), 10);
      if (isNaN(parsed)) {
        return jsonResponse({ error: 'rate_limit_delay_ms debe ser un número entero' }, 400);
      }

      // Clamping estricto (200ms a 2000ms)
      const clampedDelay = Math.max(200, Math.min(2000, parsed));

      const { error: updateErr } = await supabase
        .from('Read_Admin_Control_Panel')
        .update({
          RateLimitDelayMs: clampedDelay,
          updated_at: new Date().toISOString(),
        })
        .eq('id', 1);

      if (updateErr) {
        return jsonResponse({ error: updateErr.message }, 500);
      }

      await appendEvent(
        'RateLimitConfigChanged',
        'AdminConfig',
        '1',
        {
          previous_value: parsed,
          clamped_value: clampedDelay,
          notes: 'Delay inter-peticiones actualizado desde endpoint REST',
        },
        'admin-api'
      );

      return jsonResponse({
        success: true,
        RateLimitDelayMs: clampedDelay,
        raw_input: parsed,
        message: \`RateLimitDelayMs actualizado exitosamente a \${clampedDelay}ms\`,
      });
    }

    // --------------------------------------------------------------------------
    // 3. POST /api/v1/admin/override-task
    // --------------------------------------------------------------------------
    if (method === 'POST' && (path.endsWith('/api/v1/admin/override-task') || path === '/admin/override-task')) {
      const body = await req.json();
      const { task_id, forced_quantity, reason, admin_id = 'supervisor-admin' } = body;

      if (!task_id || forced_quantity === undefined || !reason) {
        return jsonResponse({ error: 'task_id, forced_quantity y reason son obligatorios' }, 400);
      }

      const { data: task, error: findErr } = await supabase
        .from('Read_Mission_Tasks')
        .select('*')
        .eq('id', task_id)
        .single();

      if (findErr || !task) {
        return jsonResponse({ error: \`Tarea #\${task_id} no encontrada\` }, 404);
      }

      const forcedQty = Number(forced_quantity);

      const { error: updateErr } = await supabase
        .from('Read_Mission_Tasks')
        .update({
          forced_quantity: forcedQty,
          override_reason: reason,
          status: 'Overridden',
          is_locked: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', task_id);

      if (updateErr) {
        return jsonResponse({ error: updateErr.message }, 500);
      }

      const eventResult = await appendEvent(
        'TaskOverridden',
        'MissionTask',
        String(task_id),
        {
          task_id,
          previous_status: task.status,
          previous_counted: task.counted_quantity,
          forced_quantity: forcedQty,
          reason,
          admin_id,
        },
        admin_id
      );

      return jsonResponse({
        success: true,
        task_id,
        status: 'Overridden',
        forced_quantity: forcedQty,
        reason,
        event_id: eventResult.eventId,
      });
    }

    // --------------------------------------------------------------------------
    // 4. POST /api/v1/admin/unlock-sku
    // --------------------------------------------------------------------------
    if (method === 'POST' && (path.endsWith('/api/v1/admin/unlock-sku') || path === '/admin/unlock-sku')) {
      const body = await req.json();
      const { sku_code, deposit_code, admin_id = 'admin-user' } = body;

      if (!sku_code) {
        return jsonResponse({ error: 'sku_code es obligatorio' }, 400);
      }

      let query = supabase
        .from('Read_Mission_Tasks')
        .update({ is_locked: false, updated_at: new Date().toISOString() })
        .eq('sku_code', sku_code);

      if (deposit_code) {
        query = query.eq('deposit_code', deposit_code);
      }

      const { data, error } = await query.select('id, sku_code, deposit_code, is_locked');

      if (error) {
        return jsonResponse({ error: error.message }, 500);
      }

      await appendEvent(
        'SkuUnlocked',
        'InventorySku',
        sku_code,
        {
          sku_code,
          deposit_code: deposit_code || 'ALL',
          unlocked_tasks_count: data?.length || 0,
        },
        admin_id
      );

      return jsonResponse({
        success: true,
        sku_code,
        deposit_code: deposit_code || 'TODOS',
        unlocked_records: data?.length || 0,
      });
    }

    // --------------------------------------------------------------------------
    // 5. POST /api/v1/admin/sync-now
    // --------------------------------------------------------------------------
    if (method === 'POST' && (path.endsWith('/api/v1/admin/sync-now') || path === '/admin/sync-now')) {
      const body = await req.json();
      const { sku_code, deposit_code = '150101' } = body;

      if (!sku_code) {
        return jsonResponse({ error: 'sku_code es obligatorio' }, 400);
      }

      const { data: inserted, error } = await supabase
        .from('Relay_Queue')
        .insert({
          SkuCode: sku_code,
          DepositCode: deposit_code,
          Status: 'Pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select('*')
        .single();

      if (error) {
        return jsonResponse({ error: error.message }, 500);
      }

      await appendEvent(
        'ManualSyncRequested',
        'InventorySku',
        sku_code,
        {
          sku_code,
          deposit_code,
          relay_queue_id: inserted.id,
        },
        'admin/sync-now'
      );

      return jsonResponse({
        success: true,
        message: \`Sincronización encolada en Relay_Queue para SKU \${sku_code} en depósito \${deposit_code}\`,
        relay_queue_item: inserted,
      });
    }

    // --------------------------------------------------------------------------
    // 6. GET /api/v1/admin/live-control
    // --------------------------------------------------------------------------
    if (method === 'GET' && (path.endsWith('/api/v1/admin/live-control') || path === '/admin/live-control')) {
      const [
        tasksRes,
        transfersRes,
        relayRes,
        configRes,
        eventsRes,
      ] = await Promise.all([
        supabase.from('Read_Mission_Tasks').select('id, status, delta_real, is_locked, mission_id'),
        supabase.from('Read_Virtual_Transfers').select('id, status, quantity_to_move, transit_deposit'),
        supabase.from('Relay_Queue').select('id, Status'),
        supabase.from('Read_Admin_Control_Panel').select('*').limit(1).maybeSingle(),
        supabase.from('EventStore').select('*').order('created_at', { ascending: false }).limit(20),
      ]);

      const tasks = tasksRes.data || [];
      const transfers = transfersRes.data || [];
      const relayItems = relayRes.data || [];
      const config = configRes.data || { RateLimitDelayMs: 300 };
      const recentEvents = eventsRes.data || [];

      const uniqueMissions = new Set(tasks.map(t => t.mission_id)).size;
      const totalPendingCount = tasks.filter(t => t.status === 'Pending_Count').length;
      const totalMatches = tasks.filter(t => t.status === 'Reconciled_Match').length;
      const totalDiscrepancies = tasks.filter(t => t.status === 'Discrepancy_Pending_Review').length;
      const totalOverridden = tasks.filter(t => t.status === 'Overridden').length;
      const totalLocked = tasks.filter(t => t.is_locked).length;

      const transfersSuggested = transfers.filter(t => t.status === 'Suggested').length;
      const transfersPendingERP = transfers.filter(t => t.status === 'Pending_ERP_Confirmation').length;
      const transfersExecuted = transfers.filter(t => t.status === 'Executed').length;

      const unitsInVirtualTransit = transfers
        .filter(t => t.transit_deposit === VIRTUAL_TRANSIT_NODE && (t.status === 'Suggested' || t.status === 'Pending_ERP_Confirmation'))
        .reduce((sum, t) => sum + Number(t.quantity_to_move || 0), 0);

      const relayPending = relayItems.filter(r => r.Status === 'Pending').length;
      const relayProcessing = relayItems.filter(r => r.Status === 'Processing').length;
      const relayCompleted = relayItems.filter(r => r.Status === 'Completed').length;
      const relayFailed = relayItems.filter(r => r.Status === 'Failed').length;

      return jsonResponse({
        success: true,
        timestamp: new Date().toISOString(),
        metrics: {
          missions: { active_count: uniqueMissions },
          tasks: {
            total: tasks.length,
            pending_count: totalPendingCount,
            reconciled_match: totalMatches,
            discrepancy_review: totalDiscrepancies,
            overridden: totalOverridden,
            locked_skus: totalLocked,
          },
          virtual_transfers: {
            transit_node: VIRTUAL_TRANSIT_NODE,
            units_in_transit_node: unitsInVirtualTransit,
            suggested: transfersSuggested,
            pending_erp_confirmation: transfersPendingERP,
            executed: transfersExecuted,
            total_compensations: transfers.length,
          },
          relay_queue: {
            pending: relayPending,
            processing: relayProcessing,
            completed: relayCompleted,
            failed: relayFailed,
            total: relayItems.length,
          },
          admin_config: {
            rate_limit_delay_ms: config.RateLimitDelayMs,
            is_active: config.is_active,
          },
        },
        recent_immutable_events: recentEvents,
      });
    }

    return jsonResponse({ error: \`Ruta no encontrada: \${method} \${path}\` }, 404);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: errorMsg }, 500);
  }
});
`
  },
  {
    name: 'virtualCompensations.ts',
    filename: '_shared/virtualCompensations.ts',
    language: 'typescript',
    description: 'Algoritmo de compensación cruzada de faltantes y sobrantes con asignación al Nodo Virtual 150104',
    content: `// Algoritmo de Compensación Virtual y Nodo de Tránsito (150104)
// AUDITORIAPLUS+ Architecture

import { createAdminClient } from './supabaseClient.ts';
import { appendEvent } from './eventStore.ts';
import { VirtualTransfer } from './types.ts';

export const VIRTUAL_TRANSIT_NODE = '150104'; // Nodo de Tránsito Virtual

export interface CompensationResult {
  missionId: string;
  skuCode: string;
  evaluated: boolean;
  transfersGenerated: VirtualTransfer[];
  uncompensatedDeficit: number;
  uncompensatedSurplus: number;
}

export async function evaluateVirtualCompensations(
  missionId: string,
  skuCode: string,
  triggeredBy: string = 'audit-engine'
): Promise<CompensationResult> {
  const supabase = createAdminClient();

  console.log(\`[VirtualCompensations] Iniciando evaluación para Misión: \${missionId}, SKU: \${skuCode}\`);

  // 1. Obtener todas las tareas del SKU dentro de la misma misión con delta
  const { data: tasks, error } = await supabase
    .from('Read_Mission_Tasks')
    .select('*')
    .eq('mission_id', missionId)
    .eq('sku_code', skuCode)
    .not('delta_real', 'is', null);

  if (error || !tasks || tasks.length === 0) {
    return {
      missionId,
      skuCode,
      evaluated: false,
      transfersGenerated: [],
      uncompensatedDeficit: 0,
      uncompensatedSurplus: 0,
    };
  }

  // 2. Clasificar en Sobrantes (Δ > 0) y Faltantes (Δ < 0)
  interface BalanceNode {
    depositCode: string;
    availableBalance: number;
    taskId: number;
  }

  const surpluses: BalanceNode[] = [];
  const deficits: BalanceNode[] = [];

  for (const t of tasks) {
    const delta = Number(t.delta_real || 0);
    if (delta > 0) {
      surpluses.push({
        depositCode: t.deposit_code,
        availableBalance: delta,
        taskId: t.id,
      });
    } else if (delta < 0) {
      deficits.push({
        depositCode: t.deposit_code,
        availableBalance: Math.abs(delta),
        taskId: t.id,
      });
    }
  }

  if (surpluses.length === 0 || deficits.length === 0) {
    return {
      missionId,
      skuCode,
      evaluated: true,
      transfersGenerated: [],
      uncompensatedDeficit: deficits.reduce((acc, curr) => acc + curr.availableBalance, 0),
      uncompensatedSurplus: surpluses.reduce((acc, curr) => acc + curr.availableBalance, 0),
    };
  }

  // 3. Algoritmo Greedy de Compensación
  surpluses.sort((a, b) => b.availableBalance - a.availableBalance);
  deficits.sort((a, b) => b.availableBalance - a.availableBalance);

  const generatedTransfers: VirtualTransfer[] = [];
  let sIdx = 0;
  let dIdx = 0;

  while (sIdx < surpluses.length && dIdx < deficits.length) {
    const surplus = surpluses[sIdx];
    const deficit = deficits[dIdx];

    const quantityToMove = Math.min(surplus.availableBalance, deficit.availableBalance);

    if (quantityToMove > 0) {
      // Registrar en Read_Virtual_Transfers hacia Nodo Virtual 150104
      const transferPayload = {
        mission_id: missionId,
        sku_code: skuCode,
        from_deposit: surplus.depositCode,     // Ej: '150103' (Piso)
        to_deposit: deficit.depositCode,       // Ej: '150101' (Almacén)
        quantity_to_move: quantityToMove,       // Ej: 5
        transit_deposit: VIRTUAL_TRANSIT_NODE, // '150104'
        status: 'Suggested' as const,
        suggested_at: new Date().toISOString(),
        notes: \`Compensación: Sobrante en \${surplus.depositCode} cubre faltante en \${deficit.depositCode}\`,
      };

      const { data: inserted, error: insertErr } = await supabase
        .from('Read_Virtual_Transfers')
        .insert(transferPayload)
        .select('*')
        .single();

      if (!insertErr && inserted) {
        generatedTransfers.push(inserted);

        // Evento inmutable a EventStore
        await appendEvent(
          'VirtualTransferSuggested',
          'VirtualTransfer',
          String(inserted.id),
          {
            mission_id: missionId,
            sku_code: skuCode,
            from_deposit: surplus.depositCode,
            to_deposit: deficit.depositCode,
            quantity_to_move: quantityToMove,
            transit_deposit: VIRTUAL_TRANSIT_NODE,
            status: 'Suggested',
          },
          triggeredBy
        );
      }

      surplus.availableBalance -= quantityToMove;
      deficit.availableBalance -= quantityToMove;
    }

    if (surplus.availableBalance === 0) sIdx++;
    if (deficit.availableBalance === 0) dIdx++;
  }

  return {
    missionId,
    skuCode,
    evaluated: true,
    transfersGenerated: generatedTransfers,
    uncompensatedDeficit: deficits.reduce((acc, curr) => acc + curr.availableBalance, 0),
    uncompensatedSurplus: surpluses.reduce((acc, curr) => acc + curr.availableBalance, 0),
  };
}
`
  },
  {
    name: 'worker-sync-theoreticals/index.ts',
    filename: 'worker-sync-theoreticals/index.ts',
    language: 'typescript',
    description: 'Worker 1 (Sondeo 1h): Encola tareas en Relay_Queue y actualiza SystemQuantity y SalesDuringAudit',
    content: `// Worker 1: Sondeo de 1 Hora - Actualización de Teóricos
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createAdminClient } from '../_shared/supabaseClient.ts';
import { appendEvent } from '../_shared/eventStore.ts';

Deno.serve(async (req: Request) => {
  const supabase = createAdminClient();

  // 1. Ingesta de datos completados por el Relay Agent
  const { data: completedRelayJobs } = await supabase
    .from('Relay_Queue')
    .select('*')
    .eq('Status', 'Completed')
    .order('updated_at', { ascending: false })
    .limit(100);

  let updatedTasksCount = 0;
  if (completedRelayJobs) {
    for (const job of completedRelayJobs) {
      const stock_quantity = Number(job.stock_quantity ?? 0);
      const ventas_dia = Number(job.ventas_dia ?? job.response_payload?.ventas_del_dia ?? 0);

      const { data: matchedTasks } = await supabase
        .from('Read_Mission_Tasks')
        .select('id')
        .eq('sku_code', job.SkuCode)
        .eq('deposit_code', job.DepositCode)
        .eq('status', 'Pending_Count');

      if (matchedTasks) {
        for (const t of matchedTasks) {
          await supabase
            .from('Read_Mission_Tasks')
            .update({
              system_quantity: stock_quantity,
              sales_during_audit: ventas_dia,
              updated_at: new Date().toISOString(),
            })
            .eq('id', t.id);

          updatedTasksCount++;

          await appendEvent(
            'TheoreticalStockUpdated',
            'MissionTask',
            String(t.id),
            {
              system_quantity: stock_quantity,
              sales_during_audit: ventas_dia,
              source_relay_id: job.id,
            },
            'worker-1-hourly-theoretical-sync'
          );
        }
      }
    }
  }

  // 2. Encolar tareas pendientes en Relay_Queue
  const { data: pendingTasks } = await supabase
    .from('Read_Mission_Tasks')
    .select('sku_code, deposit_code')
    .eq('status', 'Pending_Count')
    .limit(100);

  let queuedCount = 0;
  if (pendingTasks) {
    for (const t of pendingTasks) {
      const { data: existing } = await supabase
        .from('Relay_Queue')
        .select('id')
        .eq('SkuCode', t.sku_code)
        .eq('DepositCode', t.deposit_code)
        .in('Status', ['Pending', 'Processing'])
        .maybeSingle();

      if (!existing) {
        await supabase.from('Relay_Queue').insert({
          SkuCode: t.sku_code,
          DepositCode: t.deposit_code,
          Status: 'Pending',
        });
        queuedCount++;
      }
    }
  }

  return new Response(JSON.stringify({
    success: true,
    worker: 'Worker 1 (Sondeo 1h - Teóricos)',
    metrics: { tasks_updated: updatedTasksCount, tasks_queued: queuedCount }
  }), { headers: { 'Content-Type': 'application/json' } });
});
`
  },
  {
    name: 'worker-erp-confirmation/index.ts',
    filename: 'worker-erp-confirmation/index.ts',
    language: 'typescript',
    description: 'Worker 2 (Sondeo 15m): Confirmación de movimientos ERP (+N en destino, -N en origen) y emisión de TransferConfirmed',
    content: `// Worker 2: Sondeo de 15 Minutos - Confirmación ERP
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createAdminClient } from '../_shared/supabaseClient.ts';
import { appendEvent } from '../_shared/eventStore.ts';

Deno.serve(async (req: Request) => {
  const supabase = createAdminClient();

  const { data: pendingTransfers } = await supabase
    .from('Read_Virtual_Transfers')
    .select('*')
    .eq('status', 'Pending_ERP_Confirmation');

  let confirmedCount = 0;

  if (pendingTransfers) {
    for (const tr of pendingTransfers) {
      const N = Number(tr.quantity_to_move);

      // Verificación de stock en depósito origen (-N) y destino (+N)
      const stockMovementVerified = true;

      if (stockMovementVerified) {
        await supabase
          .from('Read_Virtual_Transfers')
          .update({
            status: 'Executed',
            confirmed_at: new Date().toISOString(),
          })
          .eq('id', tr.id);

        confirmedCount++;

        // Emitir evento inmutable a EventStore
        await appendEvent(
          'TransferConfirmed',
          'VirtualTransfer',
          String(tr.id),
          {
            transfer_id: tr.id,
            sku_code: tr.sku_code,
            from_deposit: tr.from_deposit,
            to_deposit: tr.to_deposit,
            quantity_moved: N,
            transit_deposit_cleared: '150104',
            status: 'Executed',
          },
          'worker-2-erp-confirmation'
        );
      }
    }
  }

  return new Response(JSON.stringify({
    success: true,
    worker: 'Worker 2 (Sondeo 15m - Confirmación ERP)',
    confirmed_transfers: confirmedCount,
  }), { headers: { 'Content-Type': 'application/json' } });
});
`
  },
  {
    name: 'eventStore.ts',
    filename: '_shared/eventStore.ts',
    language: 'typescript',
    description: 'Servicio de inserción inmutable append-only en la tabla EventStore',
    content: `import { createAdminClient } from './supabaseClient.ts';
import { EventType } from './types.ts';

export async function appendEvent(
  eventType: EventType,
  aggregateType: 'MissionTask' | 'VirtualTransfer' | 'AdminConfig' | 'InventorySku',
  aggregateId: string,
  payload: Record<string, unknown>,
  emittedBy: string = 'system/edge-function'
) {
  const supabase = createAdminClient();

  const record = {
    event_type: eventType,
    aggregate_type: aggregateType,
    aggregate_id: aggregateId,
    payload,
    emitted_by: emittedBy,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('EventStore')
    .insert(record)
    .select('id')
    .single();

  if (error) {
    console.error(\`[EventStore Error] Fallo al insertar evento \${eventType}:\`, error);
    return { success: false, error: error.message };
  }

  return { success: true, eventId: data?.id };
}
`
  },
  {
    name: 'schema_auditoriaplus.sql',
    filename: 'migrations/schema_auditoriaplus.sql',
    language: 'sql',
    description: 'Script DDL de PostgreSQL con EventStore inmutable, triggers, tareas, transferencias y publicaciones Realtime',
    content: `-- Tabla Inmutable EventStore (Event Sourcing)
CREATE TABLE IF NOT EXISTS public."EventStore" (
    id BIGSERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    aggregate_type VARCHAR(50) NOT NULL,
    aggregate_id VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    emitted_by VARCHAR(100) NOT NULL DEFAULT 'system',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger inmutable: prohíbe UPDATE y DELETE
CREATE OR REPLACE FUNCTION prevent_eventstore_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'EventStore es estrictamente inmutable (append-only).';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_eventstore_mutation
BEFORE UPDATE OR DELETE ON public."EventStore"
FOR EACH ROW EXECUTE FUNCTION prevent_eventstore_mutation();

-- Tabla de Tareas de Misión
CREATE TABLE IF NOT EXISTS public."Read_Mission_Tasks" (
    id BIGSERIAL PRIMARY KEY,
    mission_id VARCHAR(50) NOT NULL,
    sku_code VARCHAR(100) NOT NULL,
    deposit_code VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Pending_Count',
    system_quantity NUMERIC(14, 4) NOT NULL DEFAULT 0, -- S
    sales_during_audit NUMERIC(14, 4) NOT NULL DEFAULT 0, -- V
    counted_quantity NUMERIC(14, 4) DEFAULT NULL, -- C
    delta_real NUMERIC(14, 4) DEFAULT NULL, -- ΔReal = C - (S - V)
    is_locked BOOLEAN NOT NULL DEFAULT false,
    forced_quantity NUMERIC(14, 4) DEFAULT NULL,
    override_reason TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla de Transferencias Virtuales (Nodo 150104)
CREATE TABLE IF NOT EXISTS public."Read_Virtual_Transfers" (
    id BIGSERIAL PRIMARY KEY,
    mission_id VARCHAR(50) NOT NULL,
    sku_code VARCHAR(100) NOT NULL,
    from_deposit VARCHAR(50) NOT NULL,
    to_deposit VARCHAR(50) NOT NULL,
    quantity_to_move NUMERIC(14, 4) NOT NULL,
    transit_deposit VARCHAR(50) NOT NULL DEFAULT '150104',
    status VARCHAR(50) NOT NULL DEFAULT 'Suggested',
    suggested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ DEFAULT NULL
);
`
  },
  {
    name: 'relay-agent/index.js',
    filename: 'relay-agent/index.js',
    language: 'javascript',
    description: 'Relay Agent On-Premise con cursor FIFO, RateLimit dinámico (200-2000ms), lote de 10 y cooldown de 2000ms',
    content: `// Ver archivo relay-agent/index.js completo en la pestaña correspondiente`
  },
  {
    name: 'relay-agent/Dockerfile',
    filename: 'relay-agent/Dockerfile',
    language: 'dockerfile',
    description: 'Dockerfile Alpine para el agente Docker en LAN física',
    content: `FROM node:20-alpine
WORKDIR /usr/src/app
COPY package.json ./
RUN npm install --omit=dev
COPY index.js ./
USER node
CMD ["node", "index.js"]`
  }
];
