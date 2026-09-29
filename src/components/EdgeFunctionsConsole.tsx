import React, { useState } from 'react';
import { 
  Calculator, 
  ArrowRightLeft, 
  Cpu, 
  ShieldCheck, 
  Send, 
  RefreshCw, 
  Sliders, 
  Unlock, 
  AlertCircle, 
  CheckCircle2, 
  Database,
  Lock,
  Layers,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Clock,
  History
} from 'lucide-react';
import { EventStoreRecord, MissionTask, VirtualTransfer } from '../types';

export const EdgeFunctionsConsole: React.FC = () => {
  // Pre-loaded Mission Tasks simulating real Supabase state
  const [tasks, setTasks] = useState<MissionTask[]>([
    {
      id: 101,
      mission_id: 'MIS-2026-001',
      sku_code: '7591001234567',
      sku_name: 'Amoxicilina 500mg x 10 Cápsulas',
      deposit_code: '150101', // Almacén
      status: 'Pending_Count',
      system_quantity: 20, // S
      sales_during_audit: 0, // V
      counted_quantity: null,
      delta_real: null,
      is_locked: false,
      created_at: '2026-09-29T08:00:00Z',
      updated_at: '2026-09-29T08:00:00Z',
    },
    {
      id: 102,
      mission_id: 'MIS-2026-001',
      sku_code: '7591001234567',
      sku_name: 'Amoxicilina 500mg x 10 Cápsulas',
      deposit_code: '150103', // Piso de Venta
      status: 'Pending_Count',
      system_quantity: 10, // S
      sales_during_audit: 2, // V
      counted_quantity: null,
      delta_real: null,
      is_locked: false,
      created_at: '2026-09-29T08:00:00Z',
      updated_at: '2026-09-29T08:00:00Z',
    },
    {
      id: 103,
      mission_id: 'MIS-2026-001',
      sku_code: '7592004567891',
      sku_name: 'Ibuprofeno 400mg x 20 Tabletas',
      deposit_code: '150101',
      status: 'Pending_Count',
      system_quantity: 50,
      sales_during_audit: 5,
      counted_quantity: null,
      delta_real: null,
      is_locked: false,
      created_at: '2026-09-29T08:15:00Z',
      updated_at: '2026-09-29T08:15:00Z',
    }
  ]);

  // Virtual Transfers state (including Transit Node 150104)
  const [virtualTransfers, setVirtualTransfers] = useState<VirtualTransfer[]>([]);

  // Inmutable EventStore state (Append-only)
  const [eventStore, setEventStore] = useState<EventStoreRecord[]>([
    {
      id: 1,
      event_type: 'RateLimitConfigChanged',
      aggregate_type: 'AdminConfig',
      aggregate_id: '1',
      payload: { RateLimitDelayMs: 300, clamped: 300 },
      emitted_by: 'system/init',
      created_at: '2026-09-29T08:00:00Z'
    }
  ]);

  // Active testing form state for register-count
  const [selectedTaskId, setSelectedTaskId] = useState<number>(101);
  const [countedInput, setCountedInput] = useState<number>(15); // e.g. Counted 15 for Task 101 (S=20, V=0 -> Delta = -5)
  const [apiResponseJson, setApiResponseJson] = useState<string | null>(null);

  // Admin forms state
  const [rateLimitInput, setRateLimitInput] = useState<number>(300);
  const [overrideTaskId, setOverrideTaskId] = useState<number>(101);
  const [overrideQty, setOverrideQty] = useState<number>(20);
  const [overrideReason, setOverrideReason] = useState<string>('Autorizado por Supervisor: Merma física justificada');
  const [unlockSkuInput, setUnlockSkuInput] = useState<string>('7591001234567');
  const [unlockDepositInput, setUnlockDepositInput] = useState<string>('150101');
  const [syncSkuInput, setSyncSkuInput] = useState<string>('7591001234567');

  // Worker loading states
  const [worker1Running, setWorker1Running] = useState<boolean>(false);
  const [worker2Running, setWorker2Running] = useState<boolean>(false);

  // Helper to record immutable event
  const appendLocalEvent = (
    eventType: any,
    aggregateType: 'MissionTask' | 'VirtualTransfer' | 'AdminConfig' | 'InventorySku',
    aggregateId: string,
    payload: Record<string, unknown>,
    emittedBy: string = 'api-gateway'
  ) => {
    const newEvent: EventStoreRecord = {
      id: eventStore.length + 1,
      event_type: eventType,
      aggregate_type: aggregateType,
      aggregate_id: aggregateId,
      payload,
      emitted_by: emittedBy,
      created_at: new Date().toISOString()
    };
    setEventStore(prev => [newEvent, ...prev]);
  };

  // 1. ENDPOINT: POST /api/v1/audit/register-count
  const handleRegisterCount = () => {
    const task = tasks.find(t => t.id === selectedTaskId);
    if (!task) return;

    const C = Number(countedInput);
    const S = Number(task.system_quantity);
    const V = Number(task.sales_during_audit);

    // FORMULA: ΔReal = C - (S - V)
    const effectiveTheoretical = S - V;
    const deltaReal = C - effectiveTheoretical;

    // Log initial count event
    appendLocalEvent(
      'TaskCountRegistered',
      'MissionTask',
      String(task.id),
      {
        task_id: task.id,
        sku_code: task.sku_code,
        deposit_code: task.deposit_code,
        C,
        S,
        V,
        effectiveTheoretical,
        deltaReal
      },
      'auditor-scanner-01'
    );

    let updatedTasks = [...tasks];
    let generatedTransfers: VirtualTransfer[] = [];

    if (deltaReal === 0) {
      // Reconciled Match
      updatedTasks = updatedTasks.map(t =>
        t.id === task.id
          ? {
              ...t,
              counted_quantity: C,
              delta_real: 0,
              status: 'Reconciled_Match',
              is_locked: false,
              updated_at: new Date().toISOString()
            }
          : t
      );

      appendLocalEvent(
        'TaskCompleted_Match',
        'MissionTask',
        String(task.id),
        {
          task_id: task.id,
          sku: task.sku_code,
          status: 'Reconciled_Match',
          delta_real: 0
        },
        'auditor-scanner-01'
      );

      setApiResponseJson(
        JSON.stringify(
          {
            success: true,
            status: 'Reconciled_Match',
            task_id: task.id,
            math: { C, S, V, effective_theoretical: effectiveTheoretical, delta_real: 0 },
            event_emitted: 'TaskCompleted_Match',
            virtual_compensations: null
          },
          null,
          2
        )
      );
    } else {
      // Discrepancy Detected
      updatedTasks = updatedTasks.map(t =>
        t.id === task.id
          ? {
              ...t,
              counted_quantity: C,
              delta_real: deltaReal,
              status: 'Discrepancy_Pending_Review',
              is_locked: true,
              updated_at: new Date().toISOString()
            }
          : t
      );

      appendLocalEvent(
        'DiscrepancyDetected',
        'MissionTask',
        String(task.id),
        {
          task_id: task.id,
          sku: task.sku_code,
          deposit: task.deposit_code,
          delta_real: deltaReal,
          type: deltaReal > 0 ? 'Sobrante (+)' : 'Faltante (-)'
        },
        'auditor-scanner-01'
      );

      // Trigger: evaluateVirtualCompensations(missionId, skuCode)
      const sameSkuTasks = updatedTasks.filter(
        t => t.mission_id === task.mission_id && t.sku_code === task.sku_code && t.delta_real !== null
      );

      const surpluses = sameSkuTasks.filter(t => (t.delta_real || 0) > 0);
      const deficits = sameSkuTasks.filter(t => (t.delta_real || 0) < 0);

      if (surpluses.length > 0 && deficits.length > 0) {
        for (const s of surpluses) {
          for (const d of deficits) {
            const surplusAmt = s.delta_real || 0;
            const deficitAmt = Math.abs(d.delta_real || 0);
            const qtyToMove = Math.min(surplusAmt, deficitAmt);

            if (qtyToMove > 0) {
              const newTransfer: VirtualTransfer = {
                id: virtualTransfers.length + generatedTransfers.length + 1,
                mission_id: task.mission_id,
                sku_code: task.sku_code,
                from_deposit: s.deposit_code, // e.g. 150103 Piso
                to_deposit: d.deposit_code, // e.g. 150101 Almacén
                quantity_to_move: qtyToMove,
                transit_deposit: '150104', // Virtual Transit Node
                status: 'Suggested',
                suggested_at: new Date().toISOString(),
                notes: `Sobrante de ${s.deposit_code} (+${surplusAmt}) compensa faltante en ${d.deposit_code} (-${deficitAmt})`
              };

              generatedTransfers.push(newTransfer);

              appendLocalEvent(
                'VirtualTransferSuggested',
                'VirtualTransfer',
                String(newTransfer.id),
                {
                  from_deposit: newTransfer.from_deposit,
                  to_deposit: newTransfer.to_deposit,
                  quantity_to_move: qtyToMove,
                  transit_deposit: '150104',
                  status: 'Suggested'
                },
                'evaluateVirtualCompensations'
              );
            }
          }
        }
      }

      setVirtualTransfers(prev => [...generatedTransfers, ...prev]);

      setApiResponseJson(
        JSON.stringify(
          {
            success: true,
            status: 'Discrepancy_Pending_Review',
            task_id: task.id,
            math: {
              C,
              S,
              V,
              effective_theoretical: effectiveTheoretical,
              delta_real: deltaReal,
              discrepancy_type: deltaReal > 0 ? 'Sobrante (+)' : 'Faltante (-)'
            },
            event_emitted: 'DiscrepancyDetected',
            virtual_transit_node: '150104',
            virtual_compensations_generated: generatedTransfers
          },
          null,
          2
        )
      );
    }

    setTasks(updatedTasks);
  };

  // Trigger preset scenario: Almacén 150101 (-5) and Piso 150103 (+6)
  const handleLoadPrescribedScenario = () => {
    // 1. Task 101: Almacén 150101 -> S=20, V=0, C=15 => Delta = -5 (Faltante)
    // 2. Task 102: Piso 150103 -> S=10, V=2, C=16 => Delta = 16 - (10 - 2) = +6 (Sobrante)
    const updated: MissionTask[] = tasks.map(t => {
      if (t.id === 101) {
        return {
          ...t,
          counted_quantity: 15,
          delta_real: -5,
          status: 'Discrepancy_Pending_Review',
          is_locked: true
        };
      }
      if (t.id === 102) {
        return {
          ...t,
          counted_quantity: 16,
          delta_real: 6,
          status: 'Discrepancy_Pending_Review',
          is_locked: true
        };
      }
      return t;
    });

    setTasks(updated);

    // Generate Suggested Transfer
    const transfer: VirtualTransfer = {
      id: virtualTransfers.length + 1,
      mission_id: 'MIS-2026-001',
      sku_code: '7591001234567',
      from_deposit: '150103', // Piso con sobrante (+6)
      to_deposit: '150101', // Almacén con faltante (-5)
      quantity_to_move: 5,
      transit_deposit: '150104', // Nodo Virtual
      status: 'Suggested',
      suggested_at: new Date().toISOString(),
      notes: 'Compensación virtual automática: 5 unidades enviadas de Piso 150103 a Almacén 150101'
    };

    setVirtualTransfers([transfer]);

    appendLocalEvent(
      'VirtualTransferSuggested',
      'VirtualTransfer',
      String(transfer.id),
      {
        mission_id: 'MIS-2026-001',
        sku_code: '7591001234567',
        from_deposit: '150103',
        to_deposit: '150101',
        quantity_to_move: 5,
        transit_deposit: '150104',
        status: 'Suggested'
      },
      'evaluateVirtualCompensations(MIS-2026-001, 7591001234567)'
    );

    setApiResponseJson(
      JSON.stringify(
        {
          scenario: 'Escenario Prescrito de Compensación Virtual y Nodo de Tránsito (150104)',
          sku: '7591001234567 (Amoxicilina 500mg)',
          deposits: {
            'Almacén (150101)': { S: 20, V: 0, C: 15, delta: -5, type: 'Faltante' },
            'Piso (150103)': { S: 10, V: 2, C: 16, delta: 6, type: 'Sobrante' }
          },
          virtual_transfer: {
            FromDeposit: '150103',
            ToDeposit: '150101',
            QuantityToMove: 5,
            TransitDeposit: '150104',
            Status: 'Suggested'
          },
          uncompensated_surplus_remaining: 1
        },
        null,
        2
      )
    );
  };

  // 2. ENDPOINT: POST /api/v1/admin/config/rate-limit
  const handleUpdateRateLimit = () => {
    const clamped = Math.max(200, Math.min(2000, Number(rateLimitInput)));
    setRateLimitInput(clamped);

    appendLocalEvent(
      'RateLimitConfigChanged',
      'AdminConfig',
      '1',
      { previous: rateLimitInput, clamped, updated_at: new Date().toISOString() },
      'admin-api'
    );

    setApiResponseJson(
      JSON.stringify(
        {
          success: true,
          endpoint: 'POST /api/v1/admin/config/rate-limit',
          RateLimitDelayMs: clamped,
          status: 'Actualizado en Read_Admin_Control_Panel'
        },
        null,
        2
      )
    );
  };

  // 3. ENDPOINT: POST /api/v1/admin/override-task
  const handleOverrideTask = () => {
    setTasks(prev =>
      prev.map(t =>
        t.id === overrideTaskId
          ? {
              ...t,
              forced_quantity: overrideQty,
              override_reason: overrideReason,
              status: 'Overridden',
              is_locked: false
            }
          : t
      )
    );

    appendLocalEvent(
      'TaskOverridden',
      'MissionTask',
      String(overrideTaskId),
      {
        task_id: overrideTaskId,
        forced_quantity: overrideQty,
        reason: overrideReason,
        status: 'Overridden'
      },
      'admin-supervisor'
    );

    setApiResponseJson(
      JSON.stringify(
        {
          success: true,
          endpoint: 'POST /api/v1/admin/override-task',
          task_id: overrideTaskId,
          forced_quantity: overrideQty,
          status: 'Overridden'
        },
        null,
        2
      )
    );
  };

  // 4. ENDPOINT: POST /api/v1/admin/unlock-sku
  const handleUnlockSku = () => {
    setTasks(prev =>
      prev.map(t =>
        t.sku_code === unlockSkuInput && (!unlockDepositInput || t.deposit_code === unlockDepositInput)
          ? { ...t, is_locked: false }
          : t
      )
    );

    appendLocalEvent(
      'SkuUnlocked',
      'InventorySku',
      unlockSkuInput,
      {
        sku_code: unlockSkuInput,
        deposit_code: unlockDepositInput || 'ALL',
        is_locked: false
      },
      'admin-api'
    );

    setApiResponseJson(
      JSON.stringify(
        {
          success: true,
          endpoint: 'POST /api/v1/admin/unlock-sku',
          sku_code: unlockSkuInput,
          deposit_code: unlockDepositInput || 'TODOS',
          status: 'Desbloqueado operativamente'
        },
        null,
        2
      )
    );
  };

  // 5. ENDPOINT: POST /api/v1/admin/sync-now
  const handleSyncNow = () => {
    appendLocalEvent(
      'ManualSyncRequested',
      'InventorySku',
      syncSkuInput,
      {
        sku_code: syncSkuInput,
        target_relay: 'Relay_Queue',
        status: 'Pending'
      },
      'admin/sync-now'
    );

    setApiResponseJson(
      JSON.stringify(
        {
          success: true,
          endpoint: 'POST /api/v1/admin/sync-now',
          sku_code: syncSkuInput,
          message: `Petición encolada de inmediato en Relay_Queue para consulta en LAN física`
        },
        null,
        2
      )
    );
  };

  // 6. WORKER 1: Sondeo de 1 Hora - Actualización de Teóricos
  const handleRunWorker1 = async () => {
    setWorker1Running(true);
    await new Promise(r => setTimeout(r, 600));

    // Update theoreticals on pending tasks
    setTasks(prev =>
      prev.map(t => {
        if (t.status === 'Pending_Count') {
          const freshStock = t.system_quantity;
          const freshSales = Math.floor(Math.random() * 4);
          return {
            ...t,
            sales_during_audit: freshSales,
            updated_at: new Date().toISOString()
          };
        }
        return t;
      })
    );

    appendLocalEvent(
      'TheoreticalStockUpdated',
      'MissionTask',
      'ALL_PENDING',
      {
        worker: 'Worker 1 (Sondeo de 1 Hora)',
        action: 'Ingesta de stock_quantity y ventas_dia completados por Relay Agent',
        status: 'Success'
      },
      'worker-1-hourly-theoretical-sync'
    );

    setApiResponseJson(
      JSON.stringify(
        {
          worker: 'Worker 1 (Sondeo de 1 Hora - Actualización de Teóricos)',
          status: 'Completado',
          tasks_checked: tasks.filter(t => t.status === 'Pending_Count').length,
          relay_queue_sync: 'Sincronizado con Relay Agent (stock_quantity y ventas_dia)'
        },
        null,
        2
      )
    );
    setWorker1Running(false);
  };

  // 7. WORKER 2: Sondeo de 15 Minutos - Confirmación ERP
  const handleRunWorker2 = async () => {
    setWorker2Running(true);
    await new Promise(r => setTimeout(r, 700));

    // Advance Suggested -> Pending_ERP_Confirmation or Pending_ERP_Confirmation -> Executed
    setVirtualTransfers(prev =>
      prev.map(tr => {
        if (tr.status === 'Suggested') {
          return { ...tr, status: 'Pending_ERP_Confirmation', sent_to_erp_at: new Date().toISOString() };
        }
        if (tr.status === 'Pending_ERP_Confirmation') {
          return { ...tr, status: 'Executed', confirmed_at: new Date().toISOString() };
        }
        return tr;
      })
    );

    // If there were transfers confirmed
    const confirmedCount = virtualTransfers.filter(tr => tr.status === 'Pending_ERP_Confirmation').length;
    if (confirmedCount > 0) {
      appendLocalEvent(
        'TransferConfirmed',
        'VirtualTransfer',
        'BATCH',
        {
          worker: 'Worker 2 (Sondeo 15m - Confirmación ERP)',
          rule: 'Stock origen disminuyó N y destino aumentó N',
          new_status: 'Executed'
        },
        'worker-2-erp-confirmation'
      );
    }

    setApiResponseJson(
      JSON.stringify(
        {
          worker: 'Worker 2 (Sondeo de 15 Minutos - Confirmación ERP)',
          transfers_evaluated: virtualTransfers.length,
          confirmed_and_executed: confirmedCount,
          rule_applied: 'Verificación contable ERP: Origen -N y Destino +N confirmados'
        },
        null,
        2
      )
    );
    setWorker2Running(false);
  };

  // Metrics computation for live control
  const activeMissionCount = new Set(tasks.map(t => t.mission_id)).size;
  const matchCount = tasks.filter(t => t.status === 'Reconciled_Match').length;
  const discCount = tasks.filter(t => t.status === 'Discrepancy_Pending_Review').length;
  const unitsInTransit = virtualTransfers
    .filter(tr => tr.transit_deposit === '150104' && tr.status !== 'Executed')
    .reduce((sum, tr) => sum + tr.quantity_to_move, 0);

  return (
    <div className="space-y-6">
      {/* KPI Dashboard (GET /api/v1/admin/live-control Live Values) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Misiones Activas</span>
            <Database className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="text-base font-semibold text-white font-mono tabular-nums">
            {activeMissionCount} <span className="text-xs text-slate-400 font-normal">misiones</span>
          </div>
          <div className="text-xs text-slate-500 mt-1 font-mono">
            {tasks.length} tareas cargadas
          </div>
        </div>

        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Reconciliados (Δ = 0)</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-base font-semibold text-emerald-400 font-mono tabular-nums">
            {matchCount} <span className="text-xs text-slate-400 font-normal">coincidencias</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            TaskCompleted_Match
          </div>
        </div>

        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Discrepancias (Δ ≠ 0)</span>
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-base font-semibold text-amber-400 font-mono tabular-nums">
            {discCount} <span className="text-xs text-slate-400 font-normal">en revisión</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            DiscrepancyDetected
          </div>
        </div>

        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Nodo Tránsito 150104</span>
            <ArrowRightLeft className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-base font-semibold text-purple-300 font-mono tabular-nums">
            {unitsInTransit} <span className="text-xs text-slate-400 font-normal">unids retenidas</span>
          </div>
          <div className="text-xs text-slate-500 mt-1 font-mono">
            {virtualTransfers.length} transferencias
          </div>
        </div>

        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>EventStore Inmutable</span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-base font-semibold text-white font-mono tabular-nums">
            {eventStore.length} <span className="text-xs text-slate-400 font-normal">eventos</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Append-only Audit Log
          </div>
        </div>
      </div>

      {/* Main Testing Workbench Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: API Endpoints & Actions */}
        <div className="lg:col-span-5 space-y-4">
          {/* Card 1: POST /api/v1/audit/register-count & Prescribed Scenario */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Calculator className="w-4 h-4 text-emerald-400" />
                POST /api/v1/audit/register-count
              </h3>
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                ΔReal = C - (S - V)
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Calcula la discrepancia matemática neta restando las ventas en auditoría ($V$) del stock teórico ($S$).
            </p>

            {/* Prescribed Scenario Quick-Button */}
            <div className="p-3 bg-purple-950/20 border border-purple-800/40 rounded-md space-y-2">
              <div className="text-xs font-semibold text-purple-300 flex items-center justify-between">
                <span>Caso Prescrito de Compensación (150104):</span>
                <span className="text-[10px] font-mono bg-purple-900/60 px-1.5 py-0.5 rounded">1-Click</span>
              </div>
              <p className="text-[11px] text-purple-200/80 leading-normal">
                Configura automáticamente el SKU 7591001234567 con <strong>Faltante de -5 en Almacén (150101)</strong> y <strong>Sobrante de +6 en Piso (150103)</strong>, 
                generando la transferencia sugerida de 5 unidades vía <strong>Nodo 150104</strong>.
              </p>
              <button
                onClick={handleLoadPrescribedScenario}
                className="w-full py-1.5 text-xs font-semibold text-slate-950 bg-purple-300 hover:bg-purple-200 rounded transition-colors cursor-pointer"
              >
                Cargar y Ejecutar Caso de Compensación (150104)
              </button>
            </div>

            {/* Custom Task Count Form */}
            <div className="space-y-3 pt-2 border-t border-slate-800/80">
              <div className="text-xs font-medium text-slate-300">Prueba Manual con Tarea Específica:</div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Seleccionar Tarea</label>
                  <select
                    value={selectedTaskId}
                    onChange={e => setSelectedTaskId(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs text-slate-100 font-mono"
                  >
                    {tasks.map(t => (
                      <option key={t.id} value={t.id}>
                        #{t.id} - Dep. {t.deposit_code} ({t.sku_code.substring(0, 7)}...)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">
                    Cantidad Contada Físicamente (C)
                  </label>
                  <input
                    type="number"
                    value={countedInput}
                    onChange={e => setCountedInput(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs text-slate-100 font-mono"
                  />
                </div>
              </div>

              {/* Formula display for selected task */}
              {(() => {
                const cur = tasks.find(t => t.id === selectedTaskId);
                if (!cur) return null;
                const eff = cur.system_quantity - cur.sales_during_audit;
                const delta = countedInput - eff;
                return (
                  <div className="p-2.5 bg-slate-950 rounded border border-slate-800 font-mono text-[11px] text-slate-300 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Stock Teórico (S):</span>
                      <span>{cur.system_quantity}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Ventas en Auditoría (V):</span>
                      <span>{cur.sales_during_audit}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Teórico Neto (S - V):</span>
                      <span>{eff}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-800 pt-1 font-semibold">
                      <span className="text-slate-400">ΔReal = {countedInput} - {eff}:</span>
                      <span className={delta === 0 ? 'text-emerald-400' : delta > 0 ? 'text-amber-400' : 'text-rose-400'}>
                        {delta > 0 ? `+${delta} (Sobrante)` : delta < 0 ? `${delta} (Faltante)` : '0 (Match Exacto)'}
                      </span>
                    </div>
                  </div>
                );
              })()}

              <button
                onClick={handleRegisterCount}
                className="w-full py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded transition-colors cursor-pointer"
              >
                Enviar Conteo y Registrar en EventStore
              </button>
            </div>
          </div>

          {/* Card 2: Workers Trigger Console */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-sky-400" />
              Disparadores Manuales de Workers de Fondo
            </h3>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleRunWorker1}
                disabled={worker1Running}
                className="p-2.5 text-left bg-slate-800/80 hover:bg-slate-800 rounded border border-slate-700/60 transition-colors cursor-pointer"
              >
                <div className="text-xs font-semibold text-sky-300 flex items-center justify-between">
                  <span>Worker 1 (1 Hora)</span>
                  <Clock className="w-3.5 h-3.5 text-sky-400" />
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Sondeo Teórico: Encola en Relay_Queue y actualiza SystemQuantity y SalesDuringAudit
                </div>
                <div className="mt-2 text-[10px] text-sky-400 font-mono">
                  {worker1Running ? 'Ejecutando...' : '▶ Disparar Sondeo'}
                </div>
              </button>

              <button
                onClick={handleRunWorker2}
                disabled={worker2Running}
                className="p-2.5 text-left bg-slate-800/80 hover:bg-slate-800 rounded border border-slate-700/60 transition-colors cursor-pointer"
              >
                <div className="text-xs font-semibold text-emerald-300 flex items-center justify-between">
                  <span>Worker 2 (15 Minutos)</span>
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Confirmación ERP: Verifica -N origen / +N destino y emite TransferConfirmed
                </div>
                <div className="mt-2 text-[10px] text-emerald-400 font-mono">
                  {worker2Running ? 'Ejecutando...' : '▶ Disparar Confirmación'}
                </div>
              </button>
            </div>
          </div>

          {/* Card 3: Administrative API Endpoints */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-400" />
              Endpoints de Administración
            </h3>

            {/* Rate Limit Config */}
            <div className="p-2.5 bg-slate-950 rounded border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">POST /api/v1/admin/config/rate-limit</span>
                <span className="font-mono text-emerald-400 text-[11px]">{rateLimitInput} ms</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="200"
                  max="2000"
                  step="50"
                  value={rateLimitInput}
                  onChange={e => setRateLimitInput(Number(e.target.value))}
                  className="w-32 px-2.5 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-100 font-mono"
                />
                <button
                  onClick={handleUpdateRateLimit}
                  className="flex-1 py-1 px-2.5 text-xs font-medium text-slate-950 bg-amber-400 hover:bg-amber-300 rounded transition-colors cursor-pointer"
                >
                  Actualizar Delay
                </button>
              </div>
            </div>

            {/* Override Task */}
            <div className="p-2.5 bg-slate-950 rounded border border-slate-800/80 space-y-2">
              <span className="text-xs text-slate-300 font-medium block">
                POST /api/v1/admin/override-task
              </span>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="Task ID"
                  value={overrideTaskId}
                  onChange={e => setOverrideTaskId(Number(e.target.value))}
                  className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-100 font-mono"
                />
                <input
                  type="number"
                  placeholder="Cantidad Forzada"
                  value={overrideQty}
                  onChange={e => setOverrideQty(Number(e.target.value))}
                  className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-100 font-mono"
                />
              </div>
              <input
                type="text"
                placeholder="Razón de override"
                value={overrideReason}
                onChange={e => setOverrideReason(e.target.value)}
                className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-100"
              />
              <button
                onClick={handleOverrideTask}
                className="w-full py-1 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded transition-colors cursor-pointer"
              >
                Forzar Tarea (Overridden)
              </button>
            </div>

            {/* Unlock SKU & Sync Now */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 bg-slate-950 rounded border border-slate-800/80 space-y-2">
                <span className="text-[11px] text-slate-300 font-medium block">
                  POST /admin/unlock-sku
                </span>
                <input
                  type="text"
                  value={unlockSkuInput}
                  onChange={e => setUnlockSkuInput(e.target.value)}
                  className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-100 font-mono"
                />
                <button
                  onClick={handleUnlockSku}
                  className="w-full py-1 text-[11px] font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded transition-colors cursor-pointer"
                >
                  Desbloquear
                </button>
              </div>

              <div className="p-2.5 bg-slate-950 rounded border border-slate-800/80 space-y-2">
                <span className="text-[11px] text-slate-300 font-medium block">
                  POST /admin/sync-now
                </span>
                <input
                  type="text"
                  value={syncSkuInput}
                  onChange={e => setSyncSkuInput(e.target.value)}
                  className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-100 font-mono"
                />
                <button
                  onClick={handleSyncNow}
                  className="w-full py-1 text-[11px] font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded transition-colors cursor-pointer"
                >
                  Sincronizar Ya
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Tables, Virtual Transit Node 150104, EventStore & API Output */}
        <div className="lg:col-span-7 space-y-4">
          {/* Virtual Compensations & Transit Node 150104 Visualizer */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-purple-400" />
                <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
                  Compensación Virtual & Nodo de Tránsito (150104)
                </h4>
              </div>
              <span className="text-xs font-mono text-purple-300 bg-purple-950/80 px-2 py-0.5 rounded border border-purple-800/40">
                Nodo Virtual: 150104
              </span>
            </div>

            {virtualTransfers.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 font-sans border border-dashed border-slate-800 rounded-lg">
                No hay transferencias sugeridas en curso. Presiona <strong>"Cargar y Ejecutar Caso de Compensación"</strong> en el panel izquierdo para simular el caso de Almacén (-5) y Piso (+6).
              </div>
            ) : (
              <div className="space-y-3">
                {virtualTransfers.map(tr => (
                  <div
                    key={tr.id}
                    className="p-3 bg-slate-950 border border-purple-900/40 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-amber-400 font-semibold">Origen: {tr.from_deposit}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-purple-400" />
                        <span className="text-purple-300 font-bold bg-purple-900/60 px-1.5 py-0.5 rounded">
                          Tránsito: {tr.transit_deposit}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-purple-400" />
                        <span className="text-emerald-400 font-semibold">Destino: {tr.to_deposit}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-sans">
                        SKU: <code className="text-slate-200">{tr.sku_code}</code> · Mover: <strong className="text-white">{tr.quantity_to_move} unidades</strong>
                      </div>
                      {tr.notes && (
                        <div className="text-[10px] text-slate-500 font-sans italic">{tr.notes}</div>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                          tr.status === 'Executed'
                            ? 'text-emerald-300 bg-emerald-950/80 border border-emerald-800'
                            : tr.status === 'Pending_ERP_Confirmation'
                            ? 'text-sky-300 bg-sky-950/80 border border-sky-800 animate-pulse'
                            : 'text-amber-300 bg-amber-950/80 border border-amber-800'
                        }`}
                      >
                        {tr.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Table: Read_Mission_Tasks */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-400" />
                Tabla Read_Mission_Tasks (Tareas de Conteo)
              </h4>
              <span className="text-xs text-slate-400 font-mono">
                {tasks.length} tareas
              </span>
            </div>

            <div className="overflow-x-auto max-h-[220px] overflow-y-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950/70 text-slate-400 uppercase text-[10px] sticky top-0 border-b border-slate-800">
                  <tr>
                    <th className="px-3 py-2">ID</th>
                    <th className="px-3 py-2">Depósito</th>
                    <th className="px-3 py-2 text-right">S</th>
                    <th className="px-3 py-2 text-right">V</th>
                    <th className="px-3 py-2 text-right">C</th>
                    <th className="px-3 py-2 text-right">ΔReal</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2 text-center">Bloq.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {tasks.map(t => (
                    <tr key={t.id} className="hover:bg-slate-800/40">
                      <td className="px-3 py-1.5 text-slate-400">#{t.id}</td>
                      <td className="px-3 py-1.5 text-slate-200">
                        {t.deposit_code}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-slate-300">{t.system_quantity}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-slate-300">{t.sales_during_audit}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-white font-semibold">
                        {t.counted_quantity !== null ? t.counted_quantity : '—'}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums font-bold">
                        {t.delta_real === null || t.delta_real === undefined ? (
                          <span className="text-slate-500">—</span>
                        ) : t.delta_real === 0 ? (
                          <span className="text-emerald-400">0</span>
                        ) : (t.delta_real ?? 0) > 0 ? (
                          <span className="text-amber-400">+{t.delta_real}</span>
                        ) : (
                          <span className="text-rose-400">{t.delta_real}</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 font-sans">
                        <span
                          className={`text-[11px] font-semibold ${
                            t.status === 'Reconciled_Match'
                              ? 'text-emerald-400'
                              : t.status === 'Discrepancy_Pending_Review'
                              ? 'text-amber-400'
                              : t.status === 'Overridden'
                              ? 'text-purple-400'
                              : 'text-slate-400'
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        {t.is_locked ? (
                          <Lock className="w-3.5 h-3.5 text-rose-400 inline" />
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Inmutable EventStore Stream Browser */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden flex flex-col h-[260px]">
            <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                  Tabla Inmutable EventStore (Stream de Eventos)
                </h4>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                {eventStore.length} registros append-only
              </span>
            </div>

            <div className="flex-1 p-3 overflow-y-auto space-y-2 font-mono text-xs text-slate-300 scrollbar-thin">
              {eventStore.map(ev => (
                <div
                  key={ev.id}
                  className="p-2 bg-slate-900/70 border border-slate-800 rounded flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">#{ev.id}</span>
                      <span className="text-emerald-400 font-bold">[{ev.event_type}]</span>
                      <span className="text-slate-400 font-sans">· {ev.aggregate_type}:{ev.aggregate_id}</span>
                    </div>
                    <span className="text-slate-600 font-mono text-[10px]">
                      {ev.created_at.substring(11, 19)}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300 bg-slate-950 p-1.5 rounded overflow-x-auto">
                    {JSON.stringify(ev.payload)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* API Response Inspector */}
          {apiResponseJson && (
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-xs">
              <div className="text-slate-400 text-[10px] uppercase font-sans mb-1 font-semibold flex items-center justify-between">
                <span>Respuesta HTTP del Endpoint:</span>
                <span className="text-emerald-400">HTTP 200 OK</span>
              </div>
              <pre className="text-slate-200 text-[11px] overflow-x-auto p-2 bg-slate-900 rounded">
                {apiResponseJson}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
