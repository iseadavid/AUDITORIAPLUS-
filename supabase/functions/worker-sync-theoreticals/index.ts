// ==============================================================================
// Worker 1: Sondeo de 1 Hora - Actualización de Teóricos
// Edge Function en Deno / TypeScript para AUDITORIAPLUS+
// ==============================================================================
// 1. Selecciona tareas en Read_Mission_Tasks con estado 'Pending_Count'.
// 2. Inserta peticiones en Relay_Queue para que el Relay Agent las consulte en LAN.
// 3. Procesa registros completados en Relay_Queue y actualiza en Read_Mission_Tasks:
//    - SystemQuantity = stock_quantity
//    - SalesDuringAudit = ventas_dia (o ventas_del_dia)
// ==============================================================================

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createAdminClient } from '../_shared/supabaseClient.ts';
import { appendEvent } from '../_shared/eventStore.ts';

Deno.serve(async (req: Request) => {
  // CORS Headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  const startTime = Date.now();
  console.log('[Worker 1 - Hourly Theoretical Sync] Iniciando ciclo de sondeo horario...');

  const supabase = createAdminClient();

  try {
    // --------------------------------------------------------------------------
    // FASE A: Ingesta de datos completados por el Relay Agent
    // --------------------------------------------------------------------------
    // Busca registros en Relay_Queue que el agente completó contra la API física
    const { data: completedRelayJobs, error: relayFetchErr } = await supabase
      .from('Relay_Queue')
      .select('*')
      .eq('Status', 'Completed')
      .order('updated_at', { ascending: false })
      .limit(150);

    let updatedTasksCount = 0;

    if (!relayFetchErr && completedRelayJobs && completedRelayJobs.length > 0) {
      console.log(`[Worker 1] Encontrados ${completedRelayJobs.length} registros completados en Relay_Queue. Sincronizando con tareas...`);

      for (const relayJob of completedRelayJobs) {
        const skuCode = relayJob.SkuCode;
        const depositCode = relayJob.DepositCode;
        
        const rawPayload = relayJob.response_payload || {};
        const stock_quantity = Number(relayJob.stock_quantity ?? 0);
        // Soporte para ambos nombres de campo según especificación: ventas_dia o ventas_del_dia
        const ventas_dia = Number(
          relayJob.ventas_dia ?? 
          rawPayload.ventas_del_dia ?? 
          rawPayload.ventas_dia ?? 
          0
        );

        // Buscar tareas pendientes para este SKU y Depósito
        const { data: matchedTasks, error: taskFindErr } = await supabase
          .from('Read_Mission_Tasks')
          .select('id, system_quantity, sales_during_audit, status')
          .eq('sku_code', skuCode)
          .eq('deposit_code', depositCode)
          .eq('status', 'Pending_Count');

        if (!taskFindErr && matchedTasks && matchedTasks.length > 0) {
          for (const task of matchedTasks) {
            // Actualizar SystemQuantity y SalesDuringAudit
            const { error: taskUpdateErr } = await supabase
              .from('Read_Mission_Tasks')
              .update({
                system_quantity: stock_quantity,
                sales_during_audit: ventas_dia,
                updated_at: new Date().toISOString(),
              })
              .eq('id', task.id);

            if (!taskUpdateErr) {
              updatedTasksCount++;

              // Emitir evento inmutable a EventStore
              await appendEvent(
                'TheoreticalStockUpdated',
                'MissionTask',
                String(task.id),
                {
                  task_id: task.id,
                  sku_code: skuCode,
                  deposit_code: depositCode,
                  previous_system_quantity: task.system_quantity,
                  new_system_quantity: stock_quantity,
                  sales_during_audit: ventas_dia,
                  source_relay_job_id: relayJob.id,
                },
                'worker-1-hourly-theoretical-sync'
              );
            }
          }
        }
      }
    }

    // --------------------------------------------------------------------------
    // FASE B: Despacho a Relay_Queue de tareas pendientes
    // --------------------------------------------------------------------------
    // Obtener tareas en estado Pending_Count que requieran actualización teórica
    const { data: pendingTasks, error: pendingErr } = await supabase
      .from('Read_Mission_Tasks')
      .select('id, sku_code, deposit_code, updated_at')
      .eq('status', 'Pending_Count')
      .limit(100);

    let queuedRelayCount = 0;

    if (!pendingErr && pendingTasks && pendingTasks.length > 0) {
      console.log(`[Worker 1] Evaluando ${pendingTasks.length} tareas en Pending_Count para encolar en Relay_Queue...`);

      for (const task of pendingTasks) {
        // Verificar si ya existe una solicitud reciente pendiente o en procesamiento en Relay_Queue
        const { data: existingQueue } = await supabase
          .from('Relay_Queue')
          .select('id')
          .eq('SkuCode', task.sku_code)
          .eq('DepositCode', task.deposit_code)
          .in('Status', ['Pending', 'Processing'])
          .maybeSingle();

        if (!existingQueue) {
          const { error: queueInsertErr } = await supabase
            .from('Relay_Queue')
            .insert({
              SkuCode: task.sku_code,
              DepositCode: task.deposit_code,
              Status: 'Pending',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });

          if (!queueInsertErr) {
            queuedRelayCount++;
          }
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[Worker 1] Ciclo finalizado en ${duration}ms. Encolados: ${queuedRelayCount}. Actualizados: ${updatedTasksCount}.`);

    return new Response(
      JSON.stringify({
        success: true,
        worker: 'Worker 1 (Sondeo de 1 Hora - Actualización de Teóricos)',
        metrics: {
          tasks_queued_in_relay: queuedRelayCount,
          tasks_theoretical_updated: updatedTasksCount,
          execution_duration_ms: duration,
          timestamp: new Date().toISOString(),
        },
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        status: 200,
      }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[Worker 1 Error]:', errorMsg);

    return new Response(
      JSON.stringify({
        success: false,
        worker: 'Worker 1',
        error: errorMsg,
      }),
      {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        status: 500,
      }
    );
  }
});
