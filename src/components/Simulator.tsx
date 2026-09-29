import React, { useState, useEffect, useRef } from 'react';
import { RelayJob, TerminalLog } from '../types';
import { 
  Play, 
  RotateCcw, 
  Plus, 
  Layers, 
  Clock, 
  Server, 
  Database, 
  Sliders, 
  Terminal,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Hourglass,
  Gauge
} from 'lucide-react';

const SAMPLE_SKUS = [
  { sku: '7591001234567', dep: 'DEP-01', name: 'Amoxicilina 500mg' },
  { sku: '7592004567891', dep: 'DEP-01', name: 'Ibuprofeno 400mg' },
  { sku: '7593009876543', dep: 'DEP-02', name: 'Paracetamol 650mg' },
  { sku: '7594002345678', dep: 'DEP-01', name: 'Loratadina 10mg' },
  { sku: '7595008765432', dep: 'DEP-03', name: 'Omeprazol 20mg' },
  { sku: '7596003456789', dep: 'DEP-01', name: 'Losartán Potásico 50mg' },
  { sku: '7597007654321', dep: 'DEP-02', name: 'Atorvastatina 20mg' },
  { sku: '7598004567890', dep: 'DEP-01', name: 'Metformina 850mg' },
  { sku: '7599006543210', dep: 'DEP-03', name: 'Cetirizina 10mg' },
  { sku: '7590001239874', dep: 'DEP-01', name: 'Azitromicina 500mg' },
  { sku: '7591112223334', dep: 'DEP-02', name: 'Salbutamol Inhalador' },
  { sku: '7594445556667', dep: 'DEP-01', name: 'Clonazepam 2mg' },
  { sku: '7597778889990', dep: 'DEP-03', name: 'Complejo B Inyectable' },
  { sku: '7593332221115', dep: 'DEP-01', name: 'Diclofenac Sódico 75mg' },
  { sku: '7598887776664', dep: 'DEP-02', name: 'Vitamina C 1000mg' }
];

export const Simulator: React.FC = () => {
  // Database / Queue State
  const [jobs, setJobs] = useState<RelayJob[]>([]);
  const [logs, setLogs] = useState<TerminalLog[]>([]);
  
  // Rate Limiting & Anti-Saturation State
  const [rateLimitDelayMs, setRateLimitDelayMs] = useState<number>(300);
  const [consecutiveBatchCount, setConsecutiveBatchCount] = useState<number>(0);
  const [isCooldownActive, setIsCooldownActive] = useState<boolean>(false);
  const [cooldownRemainingMs, setCooldownRemainingMs] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  
  // Physical API simulation settings
  const [simulatedApiLatencyMs, setSimulatedApiLatencyMs] = useState<number>(110);
  const [simulateErrors, setSimulateErrors] = useState<boolean>(false);
  
  // Input fields for custom insertion
  const [customSku, setCustomSku] = useState<string>('7591001234567');
  const [customDeposit, setCustomDeposit] = useState<string>('DEP-01');

  // Internal mutable refs for async loop
  const nextJobIdRef = useRef<number>(1);
  const fifoQueueRef = useRef<RelayJob[]>([]);
  const isLoopRunningRef = useRef<boolean>(false);
  const consecutiveBatchRef = useRef<number>(0);
  const rateLimitRef = useRef<number>(300);
  const simulateErrorsRef = useRef<boolean>(false);
  const simulatedLatencyRef = useRef<number>(110);
  const terminalBottomRef = useRef<HTMLDivElement>(null);

  // Keep refs in sync
  useEffect(() => {
    rateLimitRef.current = rateLimitDelayMs;
  }, [rateLimitDelayMs]);

  useEffect(() => {
    simulateErrorsRef.current = simulateErrors;
  }, [simulateErrors]);

  useEffect(() => {
    simulatedLatencyRef.current = simulatedApiLatencyMs;
  }, [simulatedApiLatencyMs]);

  // Append log entry
  const addLog = (level: 'info' | 'warn' | 'error' | 'debug', message: string, tag?: string) => {
    const newLog: TerminalLog = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString().substring(11, 23),
      level,
      message,
      tag
    };
    setLogs(prev => [...prev.slice(-140), newLog]);
  };

  // Scroll logs to bottom
  useEffect(() => {
    if (terminalBottomRef.current) {
      terminalBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Initial welcome log
  useEffect(() => {
    addLog('info', 'Agente Relay MaraPlus inicializado. Escuchando suscripción WebSocket en tabla Relay_Queue (Status=Pending)...', 'BOOT');
    addLog('info', 'RateLimitDelayMs configurado en 300ms desde Read_Admin_Control_Panel. Límite de lote: 10 peticiones. Cooldown: 2000ms.', 'CONFIG');
  }, []);

  // Enqueue new job
  const enqueueJob = (sku: string, deposit: string) => {
    const id = nextJobIdRef.current++;
    const newJob: RelayJob = {
      id,
      SkuCode: sku,
      DepositCode: deposit,
      Status: 'Pending',
      created_at: new Date().toISOString()
    };

    fifoQueueRef.current.push(newJob);
    setJobs(prev => [newJob, ...prev]);
    addLog('info', `[WS-INSERT] Nuevo registro detectado en Relay_Queue #${id} (SKU: ${sku}, Dep: ${deposit})`, 'WS-EVENT');

    triggerFifoProcessor();
  };

  // Batch injection helpers
  const handleInsertMultiple = (count: number) => {
    addLog('info', `Inyectando ráfaga de ${count} registros concurrentes en Supabase...`, 'BURST');
    for (let i = 0; i < count; i++) {
      const sample = SAMPLE_SKUS[i % SAMPLE_SKUS.length];
      const skuVariant = `${sample.sku}`;
      enqueueJob(skuVariant, sample.dep);
    }
  };

  // Trigger FIFO loop
  const triggerFifoProcessor = () => {
    if (isLoopRunningRef.current) return;
    isLoopRunningRef.current = true;
    setIsProcessing(true);
    runFifoLoop();
  };

  // Core Async Loop enforcing strict user rules
  const runFifoLoop = async () => {
    while (fifoQueueRef.current.length > 0) {
      const currentJob = fifoQueueRef.current.shift()!;
      const currentBatchPosition = consecutiveBatchRef.current + 1;

      // Update state to 'Processing'
      setJobs(prev =>
        prev.map(j => (j.id === currentJob.id ? { ...j, Status: 'Processing' } : j))
      );

      const requestUrl = `http://192.168.15.225:3002/api/inventory?search=${encodeURIComponent(currentJob.SkuCode)}&deposito=${encodeURIComponent(currentJob.DepositCode)}&onlyOffers=false`;
      addLog('info', `[LOTE ${currentBatchPosition}/10] GET ${requestUrl}`, 'MARAPLUS-REQ');

      const startTime = Date.now();

      // Simulate physical API network latency
      await new Promise(r => setTimeout(r, simulatedLatencyRef.current));

      const isError = simulateErrorsRef.current && Math.random() < 0.25;

      if (isError) {
        const errorMsg = 'ECONNREFUSED / Timeout MaraPlus API 192.168.15.225:3002';
        addLog('error', `[FALLO] Petición #${currentJob.id} rechazada por el servidor local: ${errorMsg}`, 'ERROR');

        setJobs(prev =>
          prev.map(j =>
            j.id === currentJob.id
              ? {
                  ...j,
                  Status: 'Failed',
                  error_message: errorMsg,
                  durationMs: Date.now() - startTime
                }
              : j
          )
        );
      } else {
        // Realistic payload generated
        const stock_quantity = Math.floor(Math.random() * 85) + 3;
        const ventas_dia = Math.floor(Math.random() * 12);
        const precio_base = parseFloat((Math.random() * 25 + 2.5).toFixed(2));
        const impuesto_porcentaje = 16.0;
        const duration = Date.now() - startTime;

        setJobs(prev =>
          prev.map(j =>
            j.id === currentJob.id
              ? {
                  ...j,
                  Status: 'Completed',
                  stock_quantity,
                  ventas_dia,
                  precio_base,
                  impuesto_porcentaje,
                  processed_at: new Date().toISOString(),
                  durationMs: duration
                }
              : j
          )
        );

        addLog(
          'info',
          `[COMPLETED] #${currentJob.id} SKU: ${currentJob.SkuCode} | Stock: ${stock_quantity} | Ventas Día: ${ventas_dia} | Precio: $${precio_base} | IVA: ${impuesto_porcentaje}% (${duration}ms)`,
          'DB-UPDATE'
        );
      }

      // Increment batch counter
      consecutiveBatchRef.current += 1;
      setConsecutiveBatchCount(consecutiveBatchRef.current);

      // Check anti-saturation conditions:
      // Condition 1: Strict batch of 10 completed -> mandatory 2000ms pause
      if (consecutiveBatchRef.current >= 10) {
        addLog(
          'warn',
          `[ANTI-SATURACIÓN] Lote de 10 peticiones consecutivas completado. Ejecutando cooldown obligatorio de 2000ms antes del siguiente lote...`,
          'COOLDOWN'
        );

        setIsCooldownActive(true);
        const cooldownStart = Date.now();
        const cooldownTotal = 2000;

        // Visual tick for countdown display
        while (Date.now() - cooldownStart < cooldownTotal) {
          const remaining = Math.max(0, cooldownTotal - (Date.now() - cooldownStart));
          setCooldownRemainingMs(remaining);
          await new Promise(r => setTimeout(r, 50));
        }

        setIsCooldownActive(false);
        setCooldownRemainingMs(0);
        consecutiveBatchRef.current = 0;
        setConsecutiveBatchCount(0);

        addLog('info', `[ANTI-SATURACIÓN] Cooldown de 2000ms finalizado. Reanudando cursor FIFO.`, 'RESUME');
      } else {
        // Condition 2: Inter-request throttle (RateLimitDelayMs)
        if (fifoQueueRef.current.length > 0) {
          const delay = rateLimitRef.current;
          addLog('debug', `[RATE-LIMIT] Esperando ${delay}ms según Read_Admin_Control_Panel antes del siguiente elemento...`, 'DELAY');
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }

    isLoopRunningRef.current = false;
    setIsProcessing(false);
    addLog('info', 'Cola FIFO vacía. Agente Relay en modo de escucha pasiva en tiempo real.', 'IDLE');
  };

  const clearAll = () => {
    fifoQueueRef.current = [];
    consecutiveBatchRef.current = 0;
    setConsecutiveBatchCount(0);
    setIsCooldownActive(false);
    setCooldownRemainingMs(0);
    setJobs([]);
    addLog('info', 'Historial y cola reiniciados limpiamente.', 'RESET');
  };

  const pendingCount = jobs.filter(j => j.Status === 'Pending').length;
  const completedCount = jobs.filter(j => j.Status === 'Completed').length;
  const failedCount = jobs.filter(j => j.Status === 'Failed').length;

  return (
    <div className="space-y-6">
      {/* Overview Cards & Operational Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Estado del Agente</span>
            <Activity className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-sm font-semibold text-white flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                isCooldownActive
                  ? 'bg-amber-400 animate-pulse'
                  : isProcessing
                  ? 'bg-emerald-400 animate-pulse'
                  : 'bg-slate-500'
              }`}
            />
            <span>
              {isCooldownActive
                ? 'Cooldown Activo'
                : isProcessing
                ? 'Procesando Lote'
                : 'En Espera (Idle)'}
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-1 font-mono">
            LAN: 192.168.15.225:3002
          </div>
        </div>

        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Lote Anti-Saturación</span>
            <Layers className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-base font-semibold text-white font-mono tabular-nums">
            {consecutiveBatchCount} <span className="text-xs text-slate-400 font-normal">/ 10 peticiones</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1.5">
            <div
              className={`h-full transition-all duration-200 ${
                consecutiveBatchCount >= 10 ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
              style={{ width: `${(consecutiveBatchCount / 10) * 100}%` }}
            />
          </div>
        </div>

        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Pausa Obligatoria</span>
            <Clock className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-base font-semibold text-white font-mono tabular-nums">
            {isCooldownActive ? (
              <span className="text-amber-400">{cooldownRemainingMs} ms</span>
            ) : (
              <span>2000 ms <span className="text-xs text-slate-500 font-normal">(post-10)</span></span>
            )}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {isCooldownActive ? 'Enfriamiento de hardware...' : 'Espera tras cada lote'}
          </div>
        </div>

        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>RateLimitDelayMs</span>
            <Sliders className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-base font-semibold text-white font-mono tabular-nums">
            {rateLimitDelayMs} ms
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Rango: 200ms - 2000ms
          </div>
        </div>

        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Cola FIFO Total</span>
            <Hourglass className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-base font-semibold text-white font-mono tabular-nums">
            {pendingCount} <span className="text-xs text-slate-400 font-normal">pendientes</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {completedCount} completados · {failedCount} fallidos
          </div>
        </div>
      </div>

      {/* Interactive Controls & Test Workbench */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Injection & Parameters */}
        <div className="lg:col-span-4 space-y-4">
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" />
              Inyección de Peticiones en Supabase
            </h3>

            <p className="text-xs text-slate-400 leading-relaxed">
              Simula eventos <span className="text-slate-200 font-medium">INSERT</span> en la tabla{' '}
              <code className="text-slate-300 font-mono text-[11px]">Relay_Queue</code> capturados por el WebSocket del agente.
            </p>

            <div className="space-y-2">
              <label className="text-xs text-slate-300 font-medium block">
                Disparar Lotes Predefinidos:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleInsertMultiple(1)}
                  className="px-3 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors cursor-pointer text-left"
                >
                  +1 Petición Unitaria
                </button>
                <button
                  onClick={() => handleInsertMultiple(5)}
                  className="px-3 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors cursor-pointer text-left"
                >
                  +5 Peticiones
                </button>
                <button
                  onClick={() => handleInsertMultiple(10)}
                  className="px-3 py-2 text-xs font-medium text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-800/40 rounded-md transition-colors cursor-pointer text-left"
                >
                  +10 Peticiones (1 Lote)
                </button>
                <button
                  onClick={() => handleInsertMultiple(15)}
                  className="px-3 py-2 text-xs font-medium text-amber-300 bg-amber-950/60 hover:bg-amber-900/60 border border-amber-800/40 rounded-md transition-colors cursor-pointer text-left"
                >
                  +15 Ráfaga (Prueba Cooldown)
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300 font-medium">Inserción Manual Personalizada:</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">SkuCode</label>
                  <input
                    type="text"
                    value={customSku}
                    onChange={e => setCustomSku(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs text-slate-100 font-mono"
                    placeholder="7591001234567"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">DepositCode</label>
                  <input
                    type="text"
                    value={customDeposit}
                    onChange={e => setCustomDeposit(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs text-slate-100 font-mono"
                    placeholder="DEP-01"
                  />
                </div>
              </div>
              <button
                onClick={() => {
                  if (customSku.trim()) enqueueJob(customSku.trim(), customDeposit.trim() || 'DEP-01');
                }}
                className="w-full py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded transition-colors cursor-pointer"
              >
                Insertar Registro en Cola
              </button>
            </div>
          </div>

          {/* Control Panel Parameters */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-400" />
              Read_Admin_Control_Panel (Dinámico)
            </h3>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300">RateLimitDelayMs:</span>
                <span className="font-mono text-emerald-400 font-semibold">{rateLimitDelayMs} ms</span>
              </div>
              <input
                type="range"
                min="200"
                max="2000"
                step="50"
                value={rateLimitDelayMs}
                onChange={e => {
                  const val = parseInt(e.target.value, 10);
                  setRateLimitDelayMs(val);
                  addLog('info', `Simulación de cambio en Read_Admin_Control_Panel: RateLimitDelayMs = ${val}ms`, 'ADMIN-UPDATE');
                }}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>200ms (Mín)</span>
                <span>300ms (Default)</span>
                <span>2000ms (Máx)</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300">Latencia API Física MaraPlus:</span>
                <span className="font-mono text-slate-300">{simulatedApiLatencyMs} ms</span>
              </div>
              <input
                type="range"
                min="30"
                max="500"
                step="10"
                value={simulatedApiLatencyMs}
                onChange={e => setSimulatedApiLatencyMs(parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
              />
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
              <div>
                <label className="text-xs text-slate-300 font-medium block">Simular Errores / Caídas LAN</label>
                <span className="text-[11px] text-slate-500">Inyecta fallos 500 y timeouts de prueba</span>
              </div>
              <input
                type="checkbox"
                checked={simulateErrors}
                onChange={e => setSimulateErrors(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-emerald-400 focus:ring-emerald-400 cursor-pointer"
              />
            </div>

            <div className="pt-2 border-t border-slate-800/80">
              <button
                onClick={clearAll}
                className="w-full py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800/60 hover:bg-slate-800 rounded transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Limpiar Cola y Logs
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Realtime Terminal & Queue Table */}
        <div className="lg:col-span-8 space-y-4">
          {/* Realtime Live Terminal */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden flex flex-col h-[280px]">
            <div className="px-4 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs font-medium text-slate-200">
                  Consola de Telemetría del Contenedor Docker (Logs stdout)
                </span>
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                PID: 1 · node index.js
              </div>
            </div>

            <div className="flex-1 p-3 font-mono text-xs overflow-y-auto space-y-1 text-slate-300 scrollbar-thin">
              {logs.map(log => {
                let badgeClass = 'text-slate-400';
                if (log.level === 'warn') badgeClass = 'text-amber-400 font-semibold';
                if (log.level === 'error') badgeClass = 'text-rose-400 font-semibold';
                if (log.tag === 'DB-UPDATE') badgeClass = 'text-emerald-400 font-semibold';
                if (log.tag === 'COOLDOWN') badgeClass = 'text-amber-300 font-bold';

                return (
                  <div key={log.id} className="leading-tight flex items-start gap-2">
                    <span className="text-slate-600 shrink-0 select-none">{log.timestamp}</span>
                    <span className={`shrink-0 ${badgeClass}`}>
                      [{log.tag || log.level.toUpperCase()}]
                    </span>
                    <span className="text-slate-200 break-all">{log.message}</span>
                  </div>
                );
              })}
              <div ref={terminalBottomRef} />
            </div>
          </div>

          {/* Table: Supabase Relay_Queue State */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                  Tabla Relay_Queue (Estado en Supabase)
                </h4>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {jobs.length} registros cargados
              </span>
            </div>

            <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/70 text-slate-400 font-medium uppercase tracking-wider text-[10px] sticky top-0 border-b border-slate-800">
                  <tr>
                    <th className="px-3.5 py-2.5">ID</th>
                    <th className="px-3.5 py-2.5">SKU / Depósito</th>
                    <th className="px-3.5 py-2.5">Estado</th>
                    <th className="px-3.5 py-2.5 text-right">Stock</th>
                    <th className="px-3.5 py-2.5 text-right">Ventas Día</th>
                    <th className="px-3.5 py-2.5 text-right">Precio Base</th>
                    <th className="px-3.5 py-2.5 text-right">IVA %</th>
                    <th className="px-3.5 py-2.5 text-right">Tiempo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {jobs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-500 font-sans text-xs">
                        No hay peticiones en cola. Haz clic en los botones de inyección para comenzar la prueba.
                      </td>
                    </tr>
                  ) : (
                    jobs.map(job => {
                      let statusText = 'Pendiente';
                      let statusColor = 'text-slate-400';

                      if (job.Status === 'Processing') {
                        statusText = 'Procesando...';
                        statusColor = 'text-sky-400 animate-pulse';
                      } else if (job.Status === 'Completed') {
                        statusText = 'Completed';
                        statusColor = 'text-emerald-400';
                      } else if (job.Status === 'Failed') {
                        statusText = 'Failed';
                        statusColor = 'text-rose-400';
                      }

                      return (
                        <tr key={job.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="px-3.5 py-2 text-slate-400">#{job.id}</td>
                          <td className="px-3.5 py-2 text-slate-200">
                            <div>{job.SkuCode}</div>
                            <div className="text-[10px] text-slate-500 font-sans">{job.DepositCode}</div>
                          </td>
                          <td className="px-3.5 py-2">
                            <span className={`text-xs font-semibold ${statusColor}`}>
                              {statusText}
                            </span>
                            {job.error_message && (
                              <div className="text-[10px] text-rose-400 font-sans truncate max-w-[150px]">
                                {job.error_message}
                              </div>
                            )}
                          </td>
                          <td className="px-3.5 py-2 text-right tabular-nums text-slate-200">
                            {job.stock_quantity !== undefined ? job.stock_quantity : '—'}
                          </td>
                          <td className="px-3.5 py-2 text-right tabular-nums text-slate-200">
                            {job.ventas_dia !== undefined ? job.ventas_dia : '—'}
                          </td>
                          <td className="px-3.5 py-2 text-right tabular-nums text-slate-200">
                            {job.precio_base !== undefined ? `$${job.precio_base.toFixed(2)}` : '—'}
                          </td>
                          <td className="px-3.5 py-2 text-right tabular-nums text-slate-200">
                            {job.impuesto_porcentaje !== undefined ? `${job.impuesto_porcentaje}%` : '—'}
                          </td>
                          <td className="px-3.5 py-2 text-right tabular-nums text-slate-400">
                            {job.durationMs ? `${job.durationMs}ms` : '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
