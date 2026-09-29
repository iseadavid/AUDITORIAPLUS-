// Algoritmo de Compensación Virtual y Nodo de Tránsito (150104)
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

/**
 * Evalúa compensaciones virtuales cruzadas para un SKU dentro de una misma misión.
 * Si detecta depósitos con faltante (Δ < 0) y otros con sobrante (Δ > 0),
 * genera registros sugeridos en Read_Virtual_Transfers enrutados mediante el Nodo Virtual 150104
 * y emite el evento inmutable VirtualTransferSuggested en EventStore.
 */
export async function evaluateVirtualCompensations(
  missionId: string,
  skuCode: string,
  triggeredBy: string = 'audit-engine'
): Promise<CompensationResult> {
  const supabase = createAdminClient();

  console.log(`[VirtualCompensations] Iniciando evaluación para Misión: ${missionId}, SKU: ${skuCode}`);

  // 1. Obtener todas las tareas del SKU dentro de la misma misión que tengan discrepancia registrada
  const { data: tasks, error } = await supabase
    .from('Read_Mission_Tasks')
    .select('*')
    .eq('mission_id', missionId)
    .eq('sku_code', skuCode)
    .not('delta_real', 'is', null);

  if (error || !tasks || tasks.length === 0) {
    console.warn(`[VirtualCompensations] No se encontraron tareas auditadas para ${skuCode} en ${missionId}`);
    return {
      missionId,
      skuCode,
      evaluated: false,
      transfersGenerated: [],
      uncompensatedDeficit: 0,
      uncompensatedSurplus: 0,
    };
  }

  // 2. Clasificar en depósitos con Sobrante (Δ > 0) y Faltante (Δ < 0)
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
        availableBalance: Math.abs(delta), // Valor positivo para cálculo
        taskId: t.id,
      });
    }
  }

  console.log(`[VirtualCompensations] SKU ${skuCode} -> Sobrantes: ${surpluses.length}, Faltantes: ${deficits.length}`);

  const generatedTransfers: VirtualTransfer[] = [];

  // Si no hay ambos extremos (sobrante y faltante simultáneo), no hay compensación posible dentro de la misión
  if (surpluses.length === 0 || deficits.length === 0) {
    const uncompensatedSurplus = surpluses.reduce((acc, curr) => acc + curr.availableBalance, 0);
    const uncompensatedDeficit = deficits.reduce((acc, curr) => acc + curr.availableBalance, 0);

    return {
      missionId,
      skuCode,
      evaluated: true,
      transfersGenerated: [],
      uncompensatedDeficit,
      uncompensatedSurplus,
    };
  }

  // 3. Algoritmo Greedy de Asignación y Compensación
  // Une el depósito de mayor sobrante con el de mayor faltante
  surpluses.sort((a, b) => b.availableBalance - a.availableBalance);
  deficits.sort((a, b) => b.availableBalance - a.availableBalance);

  let sIdx = 0;
  let dIdx = 0;

  while (sIdx < surpluses.length && dIdx < deficits.length) {
    const surplus = surpluses[sIdx];
    const deficit = deficits[dIdx];

    const quantityToMove = Math.min(surplus.availableBalance, deficit.availableBalance);

    if (quantityToMove > 0) {
      // Verificar si ya existe una transferencia sugerida pendiente idéntica para evitar duplicar
      const { data: existing } = await supabase
        .from('Read_Virtual_Transfers')
        .select('id')
        .eq('mission_id', missionId)
        .eq('sku_code', skuCode)
        .eq('from_deposit', surplus.depositCode)
        .eq('to_deposit', deficit.depositCode)
        .eq('status', 'Suggested')
        .maybeSingle();

      if (!existing) {
        const transferPayload = {
          mission_id: missionId,
          sku_code: skuCode,
          from_deposit: surplus.depositCode,     // Ej: '150103' (Piso)
          to_deposit: deficit.depositCode,       // Ej: '150101' (Almacén)
          quantity_to_move: quantityToMove,       // Ej: 5
          transit_deposit: VIRTUAL_TRANSIT_NODE, // '150104' Nodo de Tránsito Virtual
          status: 'Suggested' as const,
          suggested_at: new Date().toISOString(),
          notes: `Compensación automática generada: Sobrante en ${surplus.depositCode} cubre faltante en ${deficit.depositCode}`,
        };

        const { data: inserted, error: insertErr } = await supabase
          .from('Read_Virtual_Transfers')
          .insert(transferPayload)
          .select('*')
          .single();

        if (insertErr) {
          console.error('[VirtualCompensations] Error al insertar transferencia:', insertErr);
        } else if (inserted) {
          generatedTransfers.push(inserted);

          // Emitir evento inmutable a EventStore
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
              source_task_surplus: surplus.taskId,
              target_task_deficit: deficit.taskId,
            },
            triggeredBy
          );

          console.log(
            `[VirtualCompensations] Sugerida transferencia #${inserted.id}: Mover ${quantityToMove} unids de [${surplus.depositCode}] -> [${deficit.depositCode}] vía Nodo Virtual [${VIRTUAL_TRANSIT_NODE}]`
          );
        }
      }

      // Descontar saldos disponibles en el algoritmo
      surplus.availableBalance -= quantityToMove;
      deficit.availableBalance -= quantityToMove;
    }

    if (surplus.availableBalance === 0) sIdx++;
    if (deficit.availableBalance === 0) dIdx++;
  }

  const uncompensatedSurplus = surpluses.reduce((acc, curr) => acc + curr.availableBalance, 0);
  const uncompensatedDeficit = deficits.reduce((acc, curr) => acc + curr.availableBalance, 0);

  return {
    missionId,
    skuCode,
    evaluated: true,
    transfersGenerated: generatedTransfers,
    uncompensatedDeficit,
    uncompensatedSurplus,
  };
}
