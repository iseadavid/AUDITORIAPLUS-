export * from './types/clientContracts';

export type JobStatus = 'Pending' | 'Processing' | 'Completed' | 'Failed';

export interface RelayJob {
  id: number;
  SkuCode: string;
  DepositCode: string;
  Status: JobStatus;
  stock_quantity?: number;
  ventas_dia?: number;
  precio_base?: number;
  impuesto_porcentaje?: number;
  error_message?: string | null;
  created_at: string;
  processed_at?: string;
  durationMs?: number;
}

export interface TerminalLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  tag?: string;
}

export interface AgentFile {
  name: string;
  filename: string;
  language: string;
  content: string;
  description: string;
}

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
  system_quantity: number; // S
  sales_during_audit: number; // V
  counted_quantity?: number | null; // C
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
  from_deposit: string;
  to_deposit: string;
  quantity_to_move: number;
  transit_deposit: string;
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
