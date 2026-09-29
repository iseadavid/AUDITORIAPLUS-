// ==============================================================================
// AUDITORIAPLUS+ Service Worker Sincronizador (flushOfflineQueue)
// ==============================================================================
// 1. Al detectar evento online, extrae registros de offline_events_queue con status 'pending'.
// 2. Ordenados estrictamente por 'timestamp_utc' original (orden causal).
// 3. Envío en ráfaga secuencial a /api/v1/audit/register-count.
// 4. Si el servidor responde HTTP 409 (Conflicto por Override), marca la tarea como 'rejected'.
// ==============================================================================

import { 
  getPendingOfflineEvents, 
  updateOfflineEventStatus, 
  OfflineEventRecord 
} from './offlineDatabase';

export interface SyncFlushResult {
  totalProcessed: number;
  syncedCount: number;
  rejectedCount: number;
  failedCount: number;
  details: Array<{
    eventId: string;
    taskId: number;
    skuCode: string;
    status: 'synced' | 'rejected' | 'failed';
    httpStatus?: number;
    message?: string;
  }>;
}

let isSyncInProgress = false;

/**
 * Función central de sincronización de la cola offline.
 * Procesa en ráfaga secuencial estricta respetando el timestamp_utc original.
 */
export async function flushOfflineQueue(
  apiBaseUrl: string = '/api/v1'
): Promise<SyncFlushResult> {
  if (isSyncInProgress) {
    console.warn('[SyncWorker] Sincronización en curso. Omitiendo ejecución concurrente.');
    return {
      totalProcessed: 0,
      syncedCount: 0,
      rejectedCount: 0,
      failedCount: 0,
      details: [],
    };
  }

  isSyncInProgress = true;
  console.log('[SyncWorker] Iniciando flushOfflineQueue() - Verificando eventos pendientes...');

  const result: SyncFlushResult = {
    totalProcessed: 0,
    syncedCount: 0,
    rejectedCount: 0,
    failedCount: 0,
    details: [],
  };

  try {
    // 1. Extraer registros con estado 'pending' ordenados estrictamente por timestamp_utc
    const pendingEvents = await getPendingOfflineEvents();

    if (pendingEvents.length === 0) {
      console.log('[SyncWorker] No hay eventos pendientes en offline_events_queue.');
      return result;
    }

    console.log(`[SyncWorker] Sincronizando ráfaga secuencial de ${pendingEvents.length} eventos offline ordenados por timestamp_utc...`);

    // 2. Envío en ráfaga secuencial
    for (const event of pendingEvents) {
      result.totalProcessed++;
      await updateOfflineEventStatus(event.client_event_id, 'syncing');

      console.log(`[SyncWorker] Enviando evento #${event.sequence_num} [SKU: ${event.sku_code}] Capturado en: ${event.timestamp_utc}`);

      try {
        const payload = {
          task_id: event.task_id,
          counted_quantity: event.counted_quantity,
          auditor_id: event.auditor_id,
          offline_client_event_id: event.client_event_id,
          original_timestamp_utc: event.timestamp_utc,
        };

        // Realizar llamada HTTP a /api/v1/audit/register-count
        const endpointUrl = `${apiBaseUrl.replace(/\/$/, '')}/audit/register-count`;
        
        const response = await fetch(endpointUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Auditor-Offline-Sync': 'true',
            'X-Client-Sequence': String(event.sequence_num),
            'X-Captured-Timestamp': event.timestamp_utc,
          },
          body: JSON.stringify(payload),
        }).catch(err => {
          // Si el fetch falla a nivel de red (ej. corte súbito de conexión o mock offline):
          return new Response(JSON.stringify({ network_error: true, message: err.message }), { status: 503 });
        });

        // 3. Evaluación de Respuestas del Servidor:
        // CASO A: HTTP 409 Conflict (Conflicto por Override en Servidor)
        // Regla: "Si el servidor responde HTTP 409 (Conflicto por Override), marca la tarea como rejected."
        if (response.status === 409) {
          const errorData = await response.json().catch(() => ({}));
          const conflictReason = errorData.reason || 'HTTP 409: Tarea sobrescrita (Overridden) por supervisor en servidor';

          console.warn(`[SyncWorker] [409 CONFLICT] Tarea #${event.task_id} fue sobrescrita. Marcando como REJECTED.`);

          await updateOfflineEventStatus(event.client_event_id, 'rejected', {
            conflict_reason: conflictReason,
            error_message: 'Conflicto de concurrencia: el conteo offline fue rechazado porque la tarea fue forzada por un supervisor.',
          });

          result.rejectedCount++;
          result.details.push({
            eventId: event.client_event_id,
            taskId: event.task_id,
            skuCode: event.sku_code,
            status: 'rejected',
            httpStatus: 409,
            message: conflictReason,
          });

          // Notificar evento localmente
          window.dispatchEvent(
            new CustomEvent('auditoria:sync_conflict', {
              detail: { event, reason: conflictReason },
            })
          );
        } 
        // CASO B: Éxito (HTTP 200 / 201)
        else if (response.ok) {
          const successData = await response.json().catch(() => ({}));
          console.log(`[SyncWorker] [200 OK] Evento #${event.client_event_id} sincronizado exitosamente.`);

          await updateOfflineEventStatus(event.client_event_id, 'synced');
          result.syncedCount++;
          result.details.push({
            eventId: event.client_event_id,
            taskId: event.task_id,
            skuCode: event.sku_code,
            status: 'synced',
            httpStatus: response.status,
            message: 'Sincronizado y consolidado en EventStore',
          });
        } 
        // CASO C: Error transitorio o caída de red
        else {
          console.warn(`[SyncWorker] Respuesta HTTP ${response.status} para evento #${event.client_event_id}. Reintentará en el próximo ciclo.`);
          
          await updateOfflineEventStatus(event.client_event_id, 'pending', {
            error_message: `HTTP ${response.status}: Reintentando sincronización`,
          });
          
          result.failedCount++;
          result.details.push({
            eventId: event.client_event_id,
            taskId: event.task_id,
            skuCode: event.sku_code,
            status: 'failed',
            httpStatus: response.status,
            message: `Fallo HTTP ${response.status}`,
          });

          // Si la conexión volvió a caerse, pausar el ciclo
          if (response.status === 503 || !navigator.onLine) {
            console.warn('[SyncWorker] Red no disponible. Pausando sincronización.');
            break;
          }
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`[SyncWorker] Error procesando evento #${event.client_event_id}:`, errorMsg);
        
        await updateOfflineEventStatus(event.client_event_id, 'pending', {
          error_message: errorMsg,
        });

        result.failedCount++;
      }
    }

    console.log(`[SyncWorker] flushOfflineQueue finalizado: ${result.syncedCount} sincronizados, ${result.rejectedCount} rechazados (409), ${result.failedCount} fallidos.`);

    // Emitir evento global de sincronización finalizada para actualizar Zustand y UI
    window.dispatchEvent(
      new CustomEvent('auditoria:sync_completed', {
        detail: result,
      })
    );

    return result;
  } finally {
    isSyncInProgress = false;
  }
}

/**
 * Inicializa los escuchadores automáticos de conectividad en el navegador
 */
export function registerSyncListeners(
  onSyncCompleted?: (result: SyncFlushResult) => void
): () => void {
  const handleOnline = () => {
    console.log('[SyncWorker] Evento online detectado en navegador. Disparando flushOfflineQueue()...');
    flushOfflineQueue().then(res => {
      if (onSyncCompleted) onSyncCompleted(res);
    });
  };

  window.addEventListener('online', handleOnline);

  return () => {
    window.removeEventListener('online', handleOnline);
  };
}
