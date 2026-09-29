// ==============================================================================
// AUDITORIAPLUS+ Client Contracts & Types (TypeScript)
// ==============================================================================

/**
 * Parámetros de consulta hacia la API de Inventario física de MaraPlus
 */
export interface ApiInventoryQueryParams {
  search: string;
  deposito: string;
  onlyOffers: boolean | string;
}

/**
 * Datos normalizados de un ítem devuelto por la API física de MaraPlus
 */
export interface InventoryItemData {
  sku_code: string;
  sku_name?: string;
  deposit_code: string;
  stock_quantity: number; // Existencia teórica física
  ventas_dia: number; // Ventas registradas durante el día
  precio_base: number; // Precio base sin impuestos
  impuesto_porcentaje: number; // Alícuota de impuesto (IVA)
  last_updated_at?: string;
}

/**
 * Estructura de respuesta estándar para consultas de inventario
 */
export interface InventoryApiResponse {
  success: boolean;
  data: InventoryItemData[] | InventoryItemData;
  total?: number;
  timestamp?: string;
  source?: 'lan_physical_api' | 'relay_queue_cache';
}

/**
 * Maestro local y global de SKUs (Catálogo de productos)
 */
export interface ReadSkuMaster {
  sku_code: string;
  barcode: string;
  description: string;
  category?: string;
  presentation?: string;
  tax_rate: number;
  is_active: boolean;
  min_stock?: number;
  max_stock?: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * Tarea individual de conteo dentro de una misión de auditoría
 */
export interface ReadMissionTask {
  id: number;
  mission_id: string;
  sku_code: string;
  sku_name?: string;
  deposit_code: string;
  status: 
    | 'Pending_Count' 
    | 'In_Progress' 
    | 'Reconciled_Match' 
    | 'Discrepancy_Pending_Review' 
    | 'Overridden' 
    | 'Completed' 
    | 'Rejected';
  system_quantity: number; // S (Teórico en ERP)
  sales_during_audit: number; // V (Ventas durante la auditoría)
  counted_quantity?: number | null; // C (Conteo físico)
  delta_real?: number | null; // ΔReal = C - (S - V)
  is_locked: boolean;
  forced_quantity?: number | null;
  override_reason?: string | null;
  auditor_id?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Transferencia virtual de compensación cruzada con asignación al Nodo Virtual 150104
 */
export interface ReadVirtualTransfer {
  id: number;
  mission_id: string;
  sku_code: string;
  from_deposit: string; // Depósito con sobrante (+Δ)
  to_deposit: string; // Depósito con faltante (-Δ)
  quantity_to_move: number;
  transit_deposit: string; // Nodo Virtual '150104'
  status: 
    | 'Suggested' 
    | 'Pending_ERP_Confirmation' 
    | 'Executed' 
    | 'Rejected' 
    | 'Cancelled';
  suggested_at: string;
  sent_to_erp_at?: string | null;
  confirmed_at?: string | null;
  erp_movement_id?: string | null;
  notes?: string | null;
}

/**
 * Perfil y métricas de gamificación del auditor
 */
export interface ReadUsersGamification {
  user_id: string;
  username: string;
  display_name: string;
  role: 'auditor' | 'supervisor' | 'admin';
  total_counts_completed: number;
  accuracy_rate: number; // Porcentaje de precisión (ej. 98.5%)
  points: number;
  badges: string[]; // Ej. ['FastCount', 'ZeroDiscrepancy', 'MasterAuditor']
  current_streak_days: number;
  last_active_at?: string;
}

/**
 * Registro inmutable en el EventStore append-only
 */
export interface EventStoreRecord {
  id: number;
  event_type: string;
  aggregate_type: 'MissionTask' | 'VirtualTransfer' | 'AdminConfig' | 'InventorySku' | 'OfflineSync';
  aggregate_id: string;
  payload: Record<string, unknown>;
  emitted_by: string;
  created_at: string;
}

/**
 * Respuesta del endpoint de control en vivo GET /api/v1/admin/live-control
 */
export interface LiveControlResponse {
  success: boolean;
  timestamp: string;
  metrics: {
    missions: {
      active_count: number;
    };
    tasks: {
      total: number;
      pending_count: number;
      reconciled_match: number;
      discrepancy_review: number;
      overridden: number;
      locked_skus: number;
    };
    virtual_transfers: {
      transit_node: string;
      units_in_transit_node: number;
      suggested: number;
      pending_erp_confirmation: number;
      executed: number;
      total_compensations: number;
    };
    relay_queue: {
      pending: number;
      processing: number;
      completed: number;
      failed: number;
      total: number;
    };
    admin_config: {
      rate_limit_delay_ms: number;
      is_active: boolean;
    };
  };
  recent_immutable_events: EventStoreRecord[];
}

/**
 * Estructura de evento pendiente en la cola offline de IndexedDB
 */
export interface OfflineEventRecord {
  client_event_id: string; // UUID v4 o timestamp con hash
  mission_id: string;
  deposit_code: string;
  task_id: number;
  sku_code: string;
  counted_quantity: number;
  sequence_num: number;
  timestamp_utc: string; // ISO 8601 estricto de captura offline
  sync_status: 'pending' | 'syncing' | 'synced' | 'rejected';
  retry_count: number;
  error_message?: string | null;
  conflict_reason?: string | null;
  auditor_id: string;
}
