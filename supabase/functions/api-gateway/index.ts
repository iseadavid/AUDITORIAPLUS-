// ==============================================================================
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
  const path = url.pathname.replace(/^\/functions\/v1\/api-gateway/, '').replace(/^\/api-gateway/, '') || url.pathname;
  const method = req.method;

  console.log(`[API Gateway] ${method} ${path}`);
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
        return jsonResponse({ error: `Tarea no encontrada con ID #${task_id}` }, 404);
      }

      const C = Number(counted_quantity);
      const S = Number(task.system_quantity || 0);
      const V = Number(task.sales_during_audit || 0);

      // FÓRMULA ESTRICTA: ΔReal = C - (S - V)
      const expectedEffectiveTheoretical = S - V;
      const deltaReal = C - expectedEffectiveTheoretical;

      console.log(`[Register Count] Tarea #${task.id} | S=${S}, V=${V} -> Teórico Neto=${expectedEffectiveTheoretical} | C=${C} -> ΔReal=${deltaReal}`);

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
          `audit/register-count-task-${task.id}`
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

      // Actualizar Read_Admin_Control_Panel
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
        message: `RateLimitDelayMs actualizado exitosamente a ${clampedDelay}ms`,
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
        return jsonResponse({ error: `Tarea #${task_id} no encontrada` }, 404);
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
        message: `Sincronización encolada en Relay_Queue para SKU ${sku_code} en depósito ${deposit_code}`,
        relay_queue_item: inserted,
      });
    }

    // --------------------------------------------------------------------------
    // 6. GET /api/v1/admin/live-control
    // --------------------------------------------------------------------------
    if (method === 'GET' && (path.endsWith('/api/v1/admin/live-control') || path === '/admin/live-control')) {
      // Consultar métricas agregadas en tiempo real
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

      // Cálculo de métricas
      const uniqueMissions = new Set(tasks.map(t => t.mission_id)).size;
      const totalPendingCount = tasks.filter(t => t.status === 'Pending_Count').length;
      const totalMatches = tasks.filter(t => t.status === 'Reconciled_Match').length;
      const totalDiscrepancies = tasks.filter(t => t.status === 'Discrepancy_Pending_Review').length;
      const totalOverridden = tasks.filter(t => t.status === 'Overridden').length;
      const totalLocked = tasks.filter(t => t.is_locked).length;

      // Transferencias virtuales
      const transfersSuggested = transfers.filter(t => t.status === 'Suggested').length;
      const transfersPendingERP = transfers.filter(t => t.status === 'Pending_ERP_Confirmation').length;
      const transfersExecuted = transfers.filter(t => t.status === 'Executed').length;

      // Unidades retenidas en Nodo de Tránsito Virtual 150104
      const unitsInVirtualTransit = transfers
        .filter(t => t.transit_deposit === VIRTUAL_TRANSIT_NODE && (t.status === 'Suggested' || t.status === 'Pending_ERP_Confirmation'))
        .reduce((sum, t) => sum + Number(t.quantity_to_move || 0), 0);

      // Cola de Relevo
      const relayPending = relayItems.filter(r => r.Status === 'Pending').length;
      const relayProcessing = relayItems.filter(r => r.Status === 'Processing').length;
      const relayCompleted = relayItems.filter(r => r.Status === 'Completed').length;
      const relayFailed = relayItems.filter(r => r.Status === 'Failed').length;

      return jsonResponse({
        success: true,
        timestamp: new Date().toISOString(),
        metrics: {
          missions: {
            active_count: uniqueMissions,
          },
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

    return jsonResponse({ error: `Ruta no encontrada: ${method} ${path}` }, 404);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[API Gateway Exception]:', errorMsg);
    return jsonResponse({ error: errorMsg }, 500);
  }
});
