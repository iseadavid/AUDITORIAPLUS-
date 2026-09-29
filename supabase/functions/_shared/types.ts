// Shared TypeScript Definitions for Supabase Edge Functions (AUDITORIAPLUS+)

export type TaskStatus = 
  | 'Pending_Count' 
  | 'In_Progress' 
  | 'Reconciled_Match' 
  | 'Discrepancy_Pending_Review' 
  | 'Overridden' 
  | 'Completed';

export type VirtualTransferStatus = 
  | 'Suggested' 
  | 'Pending_ERP_Confirmation' 
  | 'Executed' 
  | 'Rejected' 
  | 'Cancelled';

export type EventType =
  | 'TaskCountRegistered'
  | 'TaskCompleted_Match'
  | 'DiscrepancyDetected'
  | 'VirtualTransferSuggested'
  | 'VirtualTransferSentToERP'
  | 'TransferConfirmed'
  | 'TaskOverridden'
  | 'SkuUnlocked'
  | 'TheoreticalStockUpdated'
  | 'RateLimitConfigChanged'
  | 'ManualSyncRequested';

export interface MissionTask {
  id: number;
  mission_id: string;
  sku_code: string;
  sku_name?: string;
  deposit_code: string;
  status: TaskStatus;
  system_quantity: number; // S (Teórico)
  sales_during_audit: number; // V (Ventas durante auditoría)
  counted_quantity?: number | null; // C (Físico contado)
  delta_real?: number | null; // ΔReal = C - (S - V)
  is_locked: boolean;
  auditor_id?: string;
  override_reason?: string;
  forced_quantity?: number;
  created_at: string;
  updated_at: string;
}

export interface VirtualTransfer {
  id: number;
  mission_id: string;
  sku_code: string;
  from_deposit: string; // Depósito con sobrante (+Δ)
  to_deposit: string; // Depósito con faltante (-Δ)
  quantity_to_move: number;
  transit_deposit: string; // Nodo Virtual '150104'
  status: VirtualTransferStatus;
  suggested_at: string;
  sent_to_erp_at?: string | null;
  confirmed_at?: string | null;
  erp_movement_id?: string | null;
  notes?: string;
}

export interface EventStoreRecord {
  id: number;
  event_type: EventType;
  aggregate_type: 'MissionTask' | 'VirtualTransfer' | 'AdminConfig' | 'InventorySku';
  aggregate_id: string;
  payload: Record<string, unknown>;
  emitted_by: string;
  created_at: string;
}

export interface RelayQueueRecord {
  id: number;
  SkuCode: string;
  DepositCode: string;
  Status: 'Pending' | 'Processing' | 'Completed' | 'Failed';
  stock_quantity?: number;
  ventas_dia?: number;
  precio_base?: number;
  impuesto_porcentaje?: number;
  response_payload?: unknown;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface AdminControlPanel {
  id: number;
  RateLimitDelayMs: number;
  is_active: boolean;
  updated_at: string;
  notes?: string;
}
