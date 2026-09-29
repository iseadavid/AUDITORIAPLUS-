// Inmutable EventStore Service for AUDITORIAPLUS+
// Enforces append-only immutable audit trail for all business events

import { createAdminClient } from './supabaseClient.ts';
import { EventType } from './types.ts';

export async function appendEvent(
  eventType: EventType,
  aggregateType: 'MissionTask' | 'VirtualTransfer' | 'AdminConfig' | 'InventorySku',
  aggregateId: string,
  payload: Record<string, unknown>,
  emittedBy: string = 'system/edge-function'
): Promise<{ success: boolean; eventId?: number; error?: string }> {
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
    console.error(`[EventStore Error] Failed to append event ${eventType}:`, error);
    return { success: false, error: error.message };
  }

  console.log(`[EventStore] Appended event #${data?.id}: ${eventType} for [${aggregateType}:${aggregateId}]`);
  return { success: true, eventId: data?.id };
}
