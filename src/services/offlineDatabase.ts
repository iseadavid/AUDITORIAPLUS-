// ==============================================================================
// AUDITORIAPLUS+ Offline IndexedDB Service (utilizando 'idb')
// ==============================================================================
// 3 Object Stores:
// 1. missions_cache: Almacenamiento local de misiones y tareas de conteo
// 2. sku_master_local: Maestro de SKUs para escaneo y búsqueda instantánea offline
// 3. offline_events_queue: Cola FIFO transaccional con índices:
//    - idx_mission_deposit (['mission_id', 'deposit_code'])
//    - idx_sequence ('sequence_num')
//    - idx_status ('sync_status')
// ==============================================================================

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { 
  ReadMissionTask, 
  ReadSkuMaster, 
  OfflineEventRecord 
} from '../types/clientContracts';

export type { ReadMissionTask, ReadSkuMaster, OfflineEventRecord };

const DB_NAME = 'auditoriaplus_offline_db';
const DB_VERSION = 1;

export interface MissionCacheItem {
  mission_id: string;
  deposit_code: string;
  title: string;
  status: string;
  tasks: ReadMissionTask[];
  cached_at: string;
}

export interface AuditoriaPlusDBSchema extends DBSchema {
  missions_cache: {
    key: string; // mission_id
    value: MissionCacheItem;
    indexes: {
      'idx_deposit': string;
      'idx_status': string;
    };
  };
  sku_master_local: {
    key: string; // sku_code
    value: ReadSkuMaster;
    indexes: {
      'idx_barcode': string;
      'idx_description': string;
    };
  };
  offline_events_queue: {
    key: string; // client_event_id
    value: OfflineEventRecord;
    indexes: {
      // Índices explícitamente requeridos:
      'idx_mission_deposit': [string, string];
      'idx_sequence': number;
      'idx_status': string;
      // Índice auxiliar para orden cronológico estricto:
      'idx_timestamp': string;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<AuditoriaPlusDBSchema>> | null = null;

export function getOfflineDb(): Promise<IDBPDatabase<AuditoriaPlusDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<AuditoriaPlusDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        console.log(`[IndexedDB] Inicializando/Actualizando base de datos ${DB_NAME} v${newVersion}...`);

        // 1. Store: missions_cache
        if (!db.objectStoreNames.contains('missions_cache')) {
          const missionStore = db.createObjectStore('missions_cache', { keyPath: 'mission_id' });
          missionStore.createIndex('idx_deposit', 'deposit_code');
          missionStore.createIndex('idx_status', 'status');
        }

        // 2. Store: sku_master_local
        if (!db.objectStoreNames.contains('sku_master_local')) {
          const skuStore = db.createObjectStore('sku_master_local', { keyPath: 'sku_code' });
          skuStore.createIndex('idx_barcode', 'barcode');
          skuStore.createIndex('idx_description', 'description');
        }

        // 3. Store: offline_events_queue con los 3 índices estrictos
        if (!db.objectStoreNames.contains('offline_events_queue')) {
          const queueStore = db.createObjectStore('offline_events_queue', { keyPath: 'client_event_id' });
          queueStore.createIndex('idx_mission_deposit', ['mission_id', 'deposit_code']);
          queueStore.createIndex('idx_sequence', 'sequence_num');
          queueStore.createIndex('idx_status', 'sync_status');
          queueStore.createIndex('idx_timestamp', 'timestamp_utc');
        }
      },
    });
  }
  return dbPromise;
}

// ============================================================================
// OPERACIONES SOBRE missions_cache
// ============================================================================

export async function cacheMissionData(mission: MissionCacheItem): Promise<void> {
  const db = await getOfflineDb();
  await db.put('missions_cache', mission);
}

export async function getCachedMission(missionId: string): Promise<MissionCacheItem | undefined> {
  const db = await getOfflineDb();
  return db.get('missions_cache', missionId);
}

export async function getAllCachedMissions(): Promise<MissionCacheItem[]> {
  const db = await getOfflineDb();
  return db.getAll('missions_cache');
}

// ============================================================================
// OPERACIONES SOBRE sku_master_local
// ============================================================================

export async function cacheSkuList(skus: ReadSkuMaster[]): Promise<void> {
  const db = await getOfflineDb();
  const tx = db.transaction('sku_master_local', 'readwrite');
  for (const sku of skus) {
    await tx.store.put(sku);
  }
  await tx.done;
}

export async function upsertSkuMaster(sku: ReadSkuMaster): Promise<void> {
  const db = await getOfflineDb();
  await db.put('sku_master_local', sku);
}

export async function findSkuByBarcodeOrCode(codeOrBarcode: string): Promise<ReadSkuMaster | undefined> {
  const db = await getOfflineDb();
  // Búsqueda directa por clave primaria (sku_code)
  const byCode = await db.get('sku_master_local', codeOrBarcode);
  if (byCode) return byCode;

  // Búsqueda mediante índice por código de barras
  const byBarcode = await db.getFromIndex('sku_master_local', 'idx_barcode', codeOrBarcode);
  return byBarcode;
}

export async function getAllCachedSkus(): Promise<ReadSkuMaster[]> {
  const db = await getOfflineDb();
  return db.getAll('sku_master_local');
}

// ============================================================================
// OPERACIONES SOBRE offline_events_queue
// ============================================================================

let localSequenceCounter = Date.now();

/**
 * Encola un conteo físico registrado en modo offline.
 */
export async function enqueueOfflineEvent(
  params: {
    mission_id: string;
    deposit_code: string;
    task_id: number;
    sku_code: string;
    counted_quantity: number;
    auditor_id: string;
    customTimestamp?: string;
  }
): Promise<OfflineEventRecord> {
  const db = await getOfflineDb();

  const clientEventId = `ev-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const sequenceNum = ++localSequenceCounter;
  const timestampUtc = params.customTimestamp || new Date().toISOString();

  const record: OfflineEventRecord = {
    client_event_id: clientEventId,
    mission_id: params.mission_id,
    deposit_code: params.deposit_code,
    task_id: params.task_id,
    sku_code: params.sku_code,
    counted_quantity: params.counted_quantity,
    sequence_num: sequenceNum,
    timestamp_utc: timestampUtc,
    sync_status: 'pending',
    retry_count: 0,
    conflict_reason: null,
    auditor_id: params.auditor_id,
  };

  await db.put('offline_events_queue', record);
  console.log(`[IndexedDB] Evento offline encolado #${record.sequence_num}: ${record.sku_code} en ${record.deposit_code} (${record.counted_quantity} unids)`);

  return record;
}

/**
 * Extrae todos los registros con status 'pending' ordenados estrictamente por timestamp_utc
 */
export async function getPendingOfflineEvents(): Promise<OfflineEventRecord[]> {
  const db = await getOfflineDb();
  const tx = db.transaction('offline_events_queue', 'readonly');
  const index = tx.store.index('idx_status');
  
  // Obtener todos los registros con sync_status = 'pending'
  const pendingRecords = await index.getAll('pending');

  // Ordenamiento causal estricto por timestamp_utc original (FIFO estricto)
  return pendingRecords.sort((a, b) => {
    const timeA = new Date(a.timestamp_utc).getTime();
    const timeB = new Date(b.timestamp_utc).getTime();
    if (timeA !== timeB) return timeA - timeB;
    return a.sequence_num - b.sequence_num;
  });
}

/**
 * Actualiza el estado de un evento offline en IndexedDB
 */
export async function updateOfflineEventStatus(
  clientEventId: string,
  status: 'pending' | 'syncing' | 'synced' | 'rejected',
  details?: { error_message?: string; conflict_reason?: string }
): Promise<void> {
  const db = await getOfflineDb();
  const record = await db.get('offline_events_queue', clientEventId);
  if (!record) return;

  record.sync_status = status;
  if (details?.error_message !== undefined) record.error_message = details.error_message;
  if (details?.conflict_reason !== undefined) record.conflict_reason = details.conflict_reason;
  if (status === 'syncing') record.retry_count = (record.retry_count || 0) + 1;

  await db.put('offline_events_queue', record);
}

/**
 * Obtiene métricas agregadas de la cola offline
 */
export async function getOfflineQueueStats(): Promise<{
  pending: number;
  syncing: number;
  synced: number;
  rejected: number;
  total: number;
}> {
  const db = await getOfflineDb();
  const all = await db.getAll('offline_events_queue');

  return {
    pending: all.filter(r => r.sync_status === 'pending').length,
    syncing: all.filter(r => r.sync_status === 'syncing').length,
    synced: all.filter(r => r.sync_status === 'synced').length,
    rejected: all.filter(r => r.sync_status === 'rejected').length,
    total: all.length,
  };
}

/**
 * Obtiene todos los eventos de la cola offline (para inspección en UI)
 */
export async function getAllOfflineQueueRecords(): Promise<OfflineEventRecord[]> {
  const db = await getOfflineDb();
  const all = await db.getAll('offline_events_queue');
  return all.sort((a, b) => new Date(b.timestamp_utc).getTime() - new Date(a.timestamp_utc).getTime());
}

/**
 * Inicializa datos de prueba en IndexedDB si los almacenes están vacíos
 */
export async function seedInitialOfflineDataIfEmpty(): Promise<void> {
  const db = await getOfflineDb();
  const existingSkus = await db.count('sku_master_local');

  if (existingSkus === 0) {
    console.log('[IndexedDB] Sembrando catálogo inicial de SKUs y Misión de prueba...');
    
    // Sembrar Maestro de SKUs
    const initialSkus: ReadSkuMaster[] = [
      {
        sku_code: '7591001234567',
        barcode: '7591001234567',
        description: 'Amoxicilina 500mg x 10 Cápsulas',
        category: 'Antibióticos',
        presentation: 'Caja x 10 Cápsulas',
        tax_rate: 16.0,
        is_active: true,
      },
      {
        sku_code: '7592004567891',
        barcode: '7592004567891',
        description: 'Ibuprofeno 400mg x 20 Tabletas',
        category: 'Analgésicos',
        presentation: 'Caja x 20 Tabletas',
        tax_rate: 16.0,
        is_active: true,
      },
      {
        sku_code: '7593009876543',
        barcode: '7593009876543',
        description: 'Paracetamol 650mg x 10 Tabletas',
        category: 'Analgésicos',
        presentation: 'Blíster x 10 Tabletas',
        tax_rate: 16.0,
        is_active: true,
      },
      {
        sku_code: '7594002345678',
        barcode: '7594002345678',
        description: 'Loratadina 10mg x 10 Tabletas',
        category: 'Antihistamínicos',
        presentation: 'Caja x 10 Tabletas',
        tax_rate: 16.0,
        is_active: true,
      },
    ];

    await cacheSkuList(initialSkus);

    // Sembrar Misión Inicial en Caché
    const initialMission: MissionCacheItem = {
      mission_id: 'MIS-2026-001',
      deposit_code: '150101',
      title: 'Auditoría Cíclica Sucursal Centro - Farmacia',
      status: 'In_Progress',
      cached_at: new Date().toISOString(),
      tasks: [
        {
          id: 101,
          mission_id: 'MIS-2026-001',
          sku_code: '7591001234567',
          sku_name: 'Amoxicilina 500mg x 10 Cápsulas',
          deposit_code: '150101',
          status: 'Pending_Count',
          system_quantity: 20,
          sales_during_audit: 0,
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
          deposit_code: '150103',
          status: 'Pending_Count',
          system_quantity: 10,
          sales_during_audit: 2,
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
        },
      ],
    };

    await cacheMissionData(initialMission);
  }
}
