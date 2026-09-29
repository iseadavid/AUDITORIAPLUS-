import React, { useState, useEffect } from 'react';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Database, 
  Scan, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  UserCheck, 
  HardDrive, 
  Layers, 
  ArrowRight,
  ShieldAlert,
  Play,
  Check,
  XCircle,
  FileCode2
} from 'lucide-react';
import { useAuditStore } from '../store/useAuditStore';
import { 
  getAllOfflineQueueRecords, 
  getAllCachedSkus, 
  getAllCachedMissions, 
  findSkuByBarcodeOrCode, 
  OfflineEventRecord,
  ReadSkuMaster,
  MissionCacheItem,
  updateOfflineEventStatus
} from '../services/offlineDatabase';
import { flushOfflineQueue, SyncFlushResult } from '../services/offlineSyncWorker';

export const OfflinePwaCockpit: React.FC = () => {
  // Zustand State
  const { 
    currentMissionId, 
    currentDepositCode, 
    userAuth, 
    isOffline, 
    activeQueueCount, 
    setSession, 
    syncOfflineEvents, 
    setIsOffline,
    registerOfflineCount 
  } = useAuditStore();

  // Local State for IndexedDB Explorer
  const [queueRecords, setQueueRecords] = useState<OfflineEventRecord[]>([]);
  const [cachedSkus, setCachedSkus] = useState<ReadSkuMaster[]>([]);
  const [cachedMissions, setCachedMissions] = useState<MissionCacheItem[]>([]);
  const [activeIdbTab, setActiveIdbTab] = useState<'queue' | 'skus' | 'missions'>('queue');

  // Scanner Simulator State
  const [scannedInput, setScannedInput] = useState<string>('7591001234567');
  const [foundSku, setFoundSku] = useState<ReadSkuMaster | null>(null);
  const [countQuantity, setCountQuantity] = useState<number>(18);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  // Sync flush telemetry
  const [isFlushing, setIsFlushing] = useState<boolean>(false);
  const [lastFlushResult, setLastFlushResult] = useState<SyncFlushResult | null>(null);

  // Session Editor Form
  const [editMission, setEditMission] = useState<string>(currentMissionId || 'MIS-2026-001');
  const [editDeposit, setEditDeposit] = useState<string>(currentDepositCode || '150101');
  const [editUsername, setEditUsername] = useState<string>(userAuth?.username || 'carlos.auditor');
  const [editRole, setEditRole] = useState<'auditor' | 'supervisor' | 'admin'>('auditor');
  const [showSessionModal, setShowSessionModal] = useState<boolean>(false);

  // Load IndexedDB contents
  const refreshDbView = async () => {
    try {
      const [queue, skus, missions] = await Promise.all([
        getAllOfflineQueueRecords(),
        getAllCachedSkus(),
        getAllCachedMissions()
      ]);
      setQueueRecords(queue);
      setCachedSkus(skus);
      setCachedMissions(missions);
    } catch (e) {
      console.warn('Error refrescando vista IndexedDB:', e);
    }
  };

  useEffect(() => {
    refreshDbView();
  }, [activeQueueCount]);

  // Handle SKU lookup on code change
  useEffect(() => {
    if (scannedInput.trim()) {
      findSkuByBarcodeOrCode(scannedInput.trim()).then(res => {
        setFoundSku(res || null);
      });
    } else {
      setFoundSku(null);
    }
  }, [scannedInput]);

  // Handle capture of count
  const handleCaptureCount = async () => {
    if (!scannedInput.trim() || countQuantity <= 0) return;

    const taskId = scannedInput === '7591001234567' ? 101 : scannedInput === '7592004567891' ? 103 : 105;

    await registerOfflineCount({
      taskId,
      skuCode: scannedInput.trim(),
      countedQuantity: countQuantity,
    });

    setScanMessage(`Conteo de ${countQuantity} unids registrado para ${foundSku?.description || scannedInput}.`);
    setTimeout(() => setScanMessage(null), 3000);
    await refreshDbView();
  };

  // Trigger manual or simulated flush
  const handleTriggerFlush = async (simulateOverrideConflict = false) => {
    setIsFlushing(true);

    if (simulateOverrideConflict) {
      // Inyectar un registro conflictivo que provocará HTTP 409
      await registerOfflineCount({
        taskId: 999, // ID especial marcado para conflicto
        skuCode: '7591001234567',
        countedQuantity: 99,
        customTimestamp: new Date(Date.now() - 3600000).toISOString() // 1 hora atrás
      });
      await refreshDbView();
    }

    // Ejecutar flush
    const result = await syncOfflineEvents();
    setLastFlushResult(result);
    setIsFlushing(false);
    await refreshDbView();
  };

  // Simular manualmente la respuesta HTTP 409 para un elemento específico
  const handleSimulateConflict409 = async (eventId: string) => {
    await updateOfflineEventStatus(eventId, 'rejected', {
      conflict_reason: 'HTTP 409 Conflict: Tarea #101 fue forzada (Overridden) por supervisor central',
      error_message: 'Rechazado por concurrencia causal en servidor'
    });
    await refreshDbView();
  };

  const handleSaveSession = () => {
    setSession(editMission, editDeposit, {
      userId: `usr-${editUsername}`,
      username: editUsername,
      role: editRole,
      displayName: editUsername.replace('.', ' ').toUpperCase()
    });
    setShowSessionModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Online/Offline Toggle & Global Store Summary */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              isOffline
                ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
            }`}
          >
            {isOffline ? <WifiOff className="w-5 h-5" /> : <Wifi className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">
                Modo de Operación: {isOffline ? 'OFFLINE (IndexedDB)' : 'ONLINE (Supabase Conectado)'}
              </span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                  isOffline
                    ? 'bg-amber-950/80 border border-amber-800/80 text-amber-300'
                    : 'bg-emerald-950/80 border border-emerald-800/80 text-emerald-300'
                }`}
              >
                {isOffline ? 'Cola Local Activa' : 'Direct Sync'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Misión: <code className="text-slate-200">{currentMissionId || 'N/A'}</code> · Depósito:{' '}
              <code className="text-slate-200">{currentDepositCode || 'N/A'}</code> · Auditor:{' '}
              <strong className="text-slate-200">{userAuth?.displayName || userAuth?.username || 'Anónimo'}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsOffline(!isOffline)}
            className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors cursor-pointer flex items-center gap-1.5 ${
              isOffline
                ? 'bg-emerald-400 hover:bg-emerald-300 text-slate-950 shadow-sm'
                : 'bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300'
            }`}
          >
            {isOffline ? (
              <>
                <Wifi className="w-3.5 h-3.5" />
                <span>Simular Conexión (Volver Online)</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5" />
                <span>Simular Corte de Red (Modo Offline)</span>
              </>
            )}
          </button>

          <button
            onClick={() => setShowSessionModal(true)}
            className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded transition-colors cursor-pointer"
          >
            Cambiar Sesión
          </button>
        </div>
      </div>

      {/* KPI Cards: Zustand & IndexedDB State */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Cola Offline (IndexedDB)</span>
            <Layers className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-base font-semibold text-white font-mono tabular-nums">
            {activeQueueCount} <span className="text-xs text-slate-400 font-normal">pendientes</span>
          </div>
          <div className="text-xs text-slate-500 mt-1 font-mono">
            Store: offline_events_queue
          </div>
        </div>

        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Catálogo Local de SKUs</span>
            <HardDrive className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="text-base font-semibold text-white font-mono tabular-nums">
            {cachedSkus.length} <span className="text-xs text-slate-400 font-normal">productos</span>
          </div>
          <div className="text-xs text-slate-500 mt-1 font-mono">
            Store: sku_master_local
          </div>
        </div>

        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Misiones en Caché</span>
            <Database className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-base font-semibold text-white font-mono tabular-nums">
            {cachedMissions.length} <span className="text-xs text-slate-400 font-normal">misiones</span>
          </div>
          <div className="text-xs text-slate-500 mt-1 font-mono">
            Store: missions_cache
          </div>
        </div>

        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Conflictos (HTTP 409)</span>
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-base font-semibold text-rose-400 font-mono tabular-nums">
            {queueRecords.filter(r => r.sync_status === 'rejected').length}{' '}
            <span className="text-xs text-slate-400 font-normal">rejected</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Marcadas como rechazadas
          </div>
        </div>
      </div>

      {/* Main Grid: Barcode Scanner & Sincronizador flushOfflineQueue */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Barcode Scanner Simulator */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Scan className="w-4 h-4 text-emerald-400" />
                Simulador de Escáner Móvil (PWA)
              </h3>
              <span className="text-[11px] font-mono text-slate-400">
                Lector de Barras
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Permite al auditor registrar conteos físicos incluso sin internet. Si el dispositivo está sin conexión,
              el conteo se persiste de inmediato en <code className="text-slate-300 font-mono">offline_events_queue</code> con su{' '}
              <code className="text-slate-300 font-mono">timestamp_utc</code> original.
            </p>

            {/* Quick barcode presets */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-300 font-medium block">
                Seleccionar Producto de Prueba:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setScannedInput('7591001234567');
                    setCountQuantity(15);
                  }}
                  className={`p-2 text-left rounded border transition-colors cursor-pointer text-xs ${
                    scannedInput === '7591001234567'
                      ? 'bg-slate-800 border-emerald-500/60 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="font-semibold truncate">Amoxicilina 500mg</div>
                  <div className="text-[10px] text-slate-500 font-mono">7591001234567</div>
                </button>

                <button
                  onClick={() => {
                    setScannedInput('7592004567891');
                    setCountQuantity(48);
                  }}
                  className={`p-2 text-left rounded border transition-colors cursor-pointer text-xs ${
                    scannedInput === '7592004567891'
                      ? 'bg-slate-800 border-emerald-500/60 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="font-semibold truncate">Ibuprofeno 400mg</div>
                  <div className="text-[10px] text-slate-500 font-mono">7592004567891</div>
                </button>
              </div>
            </div>

            {/* Input fields */}
            <div className="space-y-3 pt-2 border-t border-slate-800/80">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">
                  Código de Barras / SKU Code
                </label>
                <input
                  type="text"
                  value={scannedInput}
                  onChange={e => setScannedInput(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs text-slate-100 font-mono"
                  placeholder="Escanee o escriba SKU..."
                />
              </div>

              {foundSku && (
                <div className="p-2.5 bg-slate-950 rounded border border-slate-800 text-xs space-y-1 font-mono">
                  <div className="text-white font-sans font-semibold">{foundSku.description}</div>
                  <div className="text-[11px] text-slate-400">
                    Categoría: {foundSku.category} · IVA: {foundSku.tax_rate}%
                  </div>
                </div>
              )}

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">
                  Cantidad Contada en Físico (C)
                </label>
                <input
                  type="number"
                  min="0"
                  value={countQuantity}
                  onChange={e => setCountQuantity(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs text-slate-100 font-mono"
                />
              </div>

              <button
                onClick={handleCaptureCount}
                className="w-full py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Registrar Conteo ({isOffline ? 'Guardar en IndexedDB' : 'Enviar a Servidor'})</span>
              </button>

              {scanMessage && (
                <div className="p-2 bg-emerald-950/40 border border-emerald-800/60 rounded text-xs text-emerald-300 font-sans">
                  {scanMessage}
                </div>
              )}
            </div>
          </div>

          {/* Sincronizador Service Worker Controls */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-sky-400" />
                Service Worker Sincronizador
              </h3>
              <span className="text-[11px] font-mono text-sky-400">
                flushOfflineQueue()
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Procesa la cola en ráfaga secuencial ordenada estrictamente por <code className="text-slate-300 font-mono">timestamp_utc</code>.
              Si el servidor responde <strong>HTTP 409 (Conflicto por Override)</strong>, marca la tarea como <strong className="text-rose-400 font-mono">rejected</strong>.
            </p>

            <div className="space-y-2">
              <button
                onClick={() => handleTriggerFlush(false)}
                disabled={isFlushing || activeQueueCount === 0}
                className="w-full py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isFlushing ? 'animate-spin' : ''}`} />
                <span>
                  {isFlushing ? 'Sincronizando ráfaga...' : `Sincronizar Cola Ahora (${activeQueueCount} pendientes)`}
                </span>
              </button>

              <button
                onClick={() => handleTriggerFlush(true)}
                disabled={isFlushing}
                className="w-full py-1.5 text-xs font-medium text-amber-300 bg-amber-950/60 hover:bg-amber-900/60 border border-amber-800/60 rounded transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>Simular Escenario de Conflicto 409 (Task Overridden)</span>
              </button>
            </div>

            {lastFlushResult && (
              <div className="p-2.5 bg-slate-950 rounded border border-slate-800 text-xs font-mono space-y-1">
                <div className="text-slate-400 font-sans font-semibold">Resultado de la última sincronización:</div>
                <div className="flex justify-between text-slate-300">
                  <span>Procesados en ráfaga:</span>
                  <span>{lastFlushResult.totalProcessed}</span>
                </div>
                <div className="flex justify-between text-emerald-400">
                  <span>Sincronizados exitosos (200 OK):</span>
                  <span>{lastFlushResult.syncedCount}</span>
                </div>
                <div className="flex justify-between text-rose-400 font-bold">
                  <span>Rechazados por conflicto (409 Conflict):</span>
                  <span>{lastFlushResult.rejectedCount}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: IndexedDB Store Explorer */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
            {/* Tabs for the 3 IndexedDB Stores */}
            <div className="px-4 py-2.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-950/70">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold text-white uppercase tracking-wider">
                  Explorador de IndexedDB ('idb')
                </span>
              </div>

              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-md border border-slate-800">
                <button
                  onClick={() => setActiveIdbTab('queue')}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                    activeIdbTab === 'queue'
                      ? 'bg-slate-800 text-white font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  offline_events_queue ({queueRecords.length})
                </button>
                <button
                  onClick={() => setActiveIdbTab('skus')}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                    activeIdbTab === 'skus'
                      ? 'bg-slate-800 text-white font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  sku_master_local ({cachedSkus.length})
                </button>
                <button
                  onClick={() => setActiveIdbTab('missions')}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                    activeIdbTab === 'missions'
                      ? 'bg-slate-800 text-white font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  missions_cache ({cachedMissions.length})
                </button>
              </div>
            </div>

            {/* TAB 1: offline_events_queue */}
            {activeIdbTab === 'queue' && (
              <div className="p-4 space-y-3">
                <div className="text-xs text-slate-400 flex items-center justify-between">
                  <span>
                    Índices activos:{' '}
                    <code className="text-slate-300 font-mono">idx_mission_deposit</code>,{' '}
                    <code className="text-slate-300 font-mono">idx_sequence</code>,{' '}
                    <code className="text-slate-300 font-mono">idx_status</code>
                  </span>
                  <button
                    onClick={refreshDbView}
                    className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Refrescar
                  </button>
                </div>

                {queueRecords.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 font-sans border border-dashed border-slate-800 rounded-lg">
                    La cola offline está vacía. Registre un conteo con el escáner para ver los eventos encolados.
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-slate-950/80 text-slate-400 text-[10px] sticky top-0 border-b border-slate-800 uppercase">
                        <tr>
                          <th className="px-3 py-2">Sec.</th>
                          <th className="px-3 py-2">SKU / Depósito</th>
                          <th className="px-3 py-2 text-right">Cant.</th>
                          <th className="px-3 py-2">Timestamp UTC</th>
                          <th className="px-3 py-2">Estado</th>
                          <th className="px-3 py-2 text-center">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {queueRecords.map(record => (
                          <tr key={record.client_event_id} className="hover:bg-slate-800/40">
                            <td className="px-3 py-2 text-slate-400 font-bold">
                              #{record.sequence_num}
                            </td>
                            <td className="px-3 py-2">
                              <div className="text-slate-200">{record.sku_code}</div>
                              <div className="text-[10px] text-slate-500 font-sans">
                                Depósito: {record.deposit_code} · Tarea #{record.task_id}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums font-bold text-white">
                              {record.counted_quantity}
                            </td>
                            <td className="px-3 py-2 text-[11px] text-slate-400">
                              {record.timestamp_utc.substring(11, 23)}
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                                  record.sync_status === 'synced'
                                    ? 'text-emerald-300 bg-emerald-950/80 border border-emerald-800'
                                    : record.sync_status === 'rejected'
                                    ? 'text-rose-300 bg-rose-950/80 border border-rose-800'
                                    : record.sync_status === 'syncing'
                                    ? 'text-sky-300 bg-sky-950/80 border border-sky-800 animate-pulse'
                                    : 'text-amber-300 bg-amber-950/80 border border-amber-800'
                                }`}
                              >
                                {record.sync_status.toUpperCase()}
                              </span>
                              {record.conflict_reason && (
                                <div className="text-[10px] text-rose-400 font-sans mt-0.5 truncate max-w-[180px]">
                                  {record.conflict_reason}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {record.sync_status === 'pending' && (
                                <button
                                  onClick={() => handleSimulateConflict409(record.client_event_id)}
                                  title="Forzar prueba de rechazo 409 Conflict"
                                  className="text-[10px] text-rose-400 hover:text-rose-300 underline cursor-pointer"
                                >
                                  Forzar 409
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: sku_master_local */}
            {activeIdbTab === 'skus' && (
              <div className="p-4 space-y-3">
                <div className="text-xs text-slate-400">
                  Catálogo local indexado por <code className="text-slate-300 font-mono">idx_barcode</code> y{' '}
                  <code className="text-slate-300 font-mono">idx_description</code> para búsquedas sin latencia.
                </div>

                <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-950/80 text-slate-400 text-[10px] sticky top-0 border-b border-slate-800 uppercase">
                      <tr>
                        <th className="px-3 py-2">Código SKU</th>
                        <th className="px-3 py-2">Descripción</th>
                        <th className="px-3 py-2">Categoría</th>
                        <th className="px-3 py-2 text-right">IVA %</th>
                        <th className="px-3 py-2 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {cachedSkus.map(sku => (
                        <tr key={sku.sku_code} className="hover:bg-slate-800/40">
                          <td className="px-3 py-2 text-slate-200 font-bold">{sku.sku_code}</td>
                          <td className="px-3 py-2 text-white font-sans">{sku.description}</td>
                          <td className="px-3 py-2 text-slate-400 font-sans">{sku.category || 'General'}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-300">{sku.tax_rate}%</td>
                          <td className="px-3 py-2 text-center">
                            <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-950/60 px-1.5 py-0.5 rounded">
                              Activo
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: missions_cache */}
            {activeIdbTab === 'missions' && (
              <div className="p-4 space-y-3">
                <div className="text-xs text-slate-400">
                  Estructura de misión cacheada con tareas pendientes e información de depósito.
                </div>

                <div className="space-y-3">
                  {cachedMissions.map(m => (
                    <div
                      key={m.mission_id}
                      className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-white">{m.title}</div>
                        <span className="text-emerald-400 font-mono text-[10px] bg-emerald-950/60 px-2 py-0.5 rounded">
                          {m.status}
                        </span>
                      </div>
                      <div className="text-slate-400 text-[11px] font-mono">
                        Misión: {m.mission_id} · Depósito: {m.deposit_code} · {m.tasks.length} tareas asociadas
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Session Modal */}
      {showSessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 max-w-md w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-400" />
                Configurar Sesión (setSession)
              </h3>
              <button
                onClick={() => setShowSessionModal(false)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1">Mission ID</label>
                <input
                  type="text"
                  value={editMission}
                  onChange={e => setEditMission(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100 font-mono"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Deposit Code</label>
                <input
                  type="text"
                  value={editDeposit}
                  onChange={e => setEditDeposit(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100 font-mono"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Username</label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={e => setEditUsername(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100 font-mono"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Rol</label>
                <select
                  value={editRole}
                  onChange={e => setEditRole(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100"
                >
                  <option value="auditor">Auditor (Conteo físico)</option>
                  <option value="supervisor">Supervisor (Control y overrides)</option>
                  <option value="admin">Administrador (Control total)</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowSessionModal(false)}
                className="flex-1 py-1.5 text-xs font-medium text-slate-400 bg-slate-800 hover:bg-slate-700 rounded transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveSession}
                className="flex-1 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded transition-colors cursor-pointer"
              >
                Guardar Sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
