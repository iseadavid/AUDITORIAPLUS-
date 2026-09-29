/**
 * M2: Overrides (/admin/overrides)
 * AUDITORIAPLUS+ Superuser Desktop Cockpit (1920x1080)
 * 
 * Modales interactivos para:
 * 1. Reconciliación forzada (override-task): payload { task_id, forced_quantity, reason }
 * 2. Desbloqueo de sesiones/SKU (unlock-sku): payload { sku_code, deposit_code }
 * 3. Sincronización prioritaria (sync-now): payload { sku_code }
 */

import React, { useState } from 'react';
import { useAuditStore } from '../../store/useAuditStore';
import { ReadMissionTask } from '../../types/clientContracts';
import { 
  ShieldAlert, 
  Lock, 
  Unlock, 
  RotateCw, 
  AlertTriangle, 
  CheckCircle2, 
  Search, 
  Filter, 
  FileEdit, 
  Zap, 
  X, 
  Check, 
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

export const AdminOverridesView: React.FC = () => {
  const { 
    missionTasks, 
    overrideTaskAction, 
    unlockSkuAction, 
    syncNowAction 
  } = useAuditStore();

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedDeposit, setSelectedDeposit] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Modal 1: Reconciliación Forzada (override-task)
  const [showOverrideModal, setShowOverrideModal] = useState<boolean>(false);
  const [targetTask, setTargetTask] = useState<ReadMissionTask | null>(null);
  const [forcedQuantity, setForcedQuantity] = useState<number>(0);
  const [overrideReason, setOverrideReason] = useState<string>('Aprobación de gerencia por merma natural documentada');
  const [isSubmittingOverride, setIsSubmittingOverride] = useState<boolean>(false);

  // Modal 2: Desbloqueo de SKU (unlock-sku)
  const [showUnlockModal, setShowUnlockModal] = useState<boolean>(false);
  const [unlockSkuCode, setUnlockSkuCode] = useState<string>('');
  const [unlockDepositCode, setUnlockDepositCode] = useState<string>('150101');
  const [isSubmittingUnlock, setIsSubmittingUnlock] = useState<boolean>(false);

  // Modal 3: Sincronización Prioritaria (sync-now)
  const [showSyncModal, setShowSyncModal] = useState<boolean>(false);
  const [syncSkuCode, setSyncSkuCode] = useState<string>('');
  const [isSubmittingSync, setIsSubmittingSync] = useState<boolean>(false);

  // Notification Toast
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const notify = (msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 4000);
  };

  // Filter Tasks
  const filteredTasks = missionTasks.filter(task => {
    const matchesSearch = 
      task.sku_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (task.sku_name || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesDeposit = selectedDeposit === 'all' || task.deposit_code === selectedDeposit;
    const matchesStatus = selectedStatus === 'all' || task.status === selectedStatus;

    return matchesSearch && matchesDeposit && matchesStatus;
  });

  // Action: Open Override Modal
  const handleOpenOverride = (task: ReadMissionTask) => {
    setTargetTask(task);
    setForcedQuantity(task.counted_quantity ?? task.system_quantity);
    setOverrideReason('Revisión física directa del supervisor en almacén');
    setShowOverrideModal(true);
  };

  // Submit Override
  const handleSubmitOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetTask) return;
    if (!overrideReason.trim()) {
      alert('Debes indicar un motivo forense obligatorio para registrar el override inmutable.');
      return;
    }

    setIsSubmittingOverride(true);
    await overrideTaskAction(targetTask.id, forcedQuantity, overrideReason.trim());
    setIsSubmittingOverride(false);
    setShowOverrideModal(false);
    notify(`Override ejecutado para Tarea #${targetTask.id} (${targetTask.sku_code}): ${forcedQuantity} uds.`);
  };

  // Submit Unlock SKU
  const handleSubmitUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockSkuCode.trim()) return;

    setIsSubmittingUnlock(true);
    await unlockSkuAction(unlockSkuCode.trim(), unlockDepositCode);
    setIsSubmittingUnlock(false);
    setShowUnlockModal(false);
    notify(`SKU ${unlockSkuCode} desbloqueado exitosamente en depósito ${unlockDepositCode}.`);
  };

  // Submit Sync Now
  const handleSubmitSyncNow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!syncSkuCode.trim()) return;

    setIsSubmittingSync(true);
    const res = await syncNowAction(syncSkuCode.trim());
    setIsSubmittingSync(false);
    setShowSyncModal(false);
    notify(res.message);
  };

  return (
    <div className="space-y-6">
      {/* Route & Sub-header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400 bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded">
              M2: OVERRIDES & DESBLOQUEOS
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-xs font-mono text-slate-400">/admin/overrides</span>
            <span className="text-slate-600">·</span>
            <span className="text-xs text-slate-400">Modales Interactivos Forenses</span>
          </div>
          <h2 className="text-xl font-bold text-white mt-1">
            Gestión de Excepciones, Reconciliación Forzada y Desbloqueos
          </h2>
          <p className="text-xs text-slate-400">
            Ejecuta llamadas autorizadas a <code>POST /api/v1/admin/override-task</code>, <code>unlock-sku</code> y <code>sync-now</code> con registro inmutable en EventStore.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 self-start xl:self-auto">
          <button
            onClick={() => {
              setUnlockSkuCode('7593009876543');
              setUnlockDepositCode('150101');
              setShowUnlockModal(true);
            }}
            className="px-3 py-1.5 text-xs font-semibold text-amber-300 bg-amber-950/80 border border-amber-800 hover:bg-amber-900 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Unlock className="w-3.5 h-3.5" />
            <span>Desbloquear SKU</span>
          </button>

          <button
            onClick={() => {
              setSyncSkuCode('7591001234567');
              setShowSyncModal(true);
            }}
            className="px-3 py-1.5 text-xs font-semibold text-emerald-400 bg-emerald-950/80 border border-emerald-800 hover:bg-emerald-900 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Sincronizar Prioritario (Sync Now)</span>
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {actionFeedback && (
        <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-200 flex items-center justify-between gap-3 text-xs font-mono shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionFeedback}</span>
          </div>
          <button onClick={() => setActionFeedback(null)} className="text-emerald-400 hover:text-white cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filters and Table Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        {/* Search & Filters Toolbar */}
        <div className="p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-950/50">
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              placeholder="Buscar por SKU o descripción..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white outline-none focus:border-amber-400 placeholder:text-slate-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              value={selectedDeposit}
              onChange={(e) => setSelectedDeposit(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-200 px-3 py-1.5 rounded-lg outline-none text-xs"
            >
              <option value="all">Todos los Depósitos</option>
              <option value="150101">150101 - Almacén</option>
              <option value="150103">150103 - Piso de Venta</option>
              <option value="150102">150102 - Avería</option>
              <option value="150107">150107 - Galpón</option>
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-200 px-3 py-1.5 rounded-lg outline-none text-xs"
            >
              <option value="all">Todos los Estados</option>
              <option value="Pending_Count">Pending_Count</option>
              <option value="In_Progress">In_Progress</option>
              <option value="Reconciled_Match">Reconciled_Match</option>
              <option value="Discrepancy_Pending_Review">Discrepancy_Pending_Review</option>
              <option value="Overridden">Overridden (Forzado)</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
        </div>

        {/* Tasks Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Descripción</th>
                <th className="px-4 py-3">Depósito</th>
                <th className="px-4 py-3">S (Teórico)</th>
                <th className="px-4 py-3">V (Ventas)</th>
                <th className="px-4 py-3">C (Físico)</th>
                <th className="px-4 py-3">ΔReal</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones Superusuario</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-mono">
              {filteredTasks.map((task) => {
                const isOverridden = task.status === 'Overridden';
                const isLocked = task.is_locked || task.status === 'Completed' || task.status === 'Reconciled_Match';

                return (
                  <tr key={task.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 text-slate-500">#{task.id}</td>
                    <td className="px-4 py-3 text-white font-bold">{task.sku_code}</td>
                    <td className="px-4 py-3 text-slate-300 font-sans">{task.sku_name || 'Sin nombre'}</td>
                    <td className="px-4 py-3 text-slate-400">{task.deposit_code}</td>
                    <td className="px-4 py-3 text-slate-200">{task.system_quantity}</td>
                    <td className="px-4 py-3 text-slate-400">{task.sales_during_audit}</td>
                    <td className="px-4 py-3 text-emerald-300 font-bold">
                      {task.counted_quantity !== null && task.counted_quantity !== undefined ? task.counted_quantity : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {task.delta_real !== null && task.delta_real !== undefined ? (
                        <span className={`font-bold ${task.delta_real === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {task.delta_real > 0 ? `+${task.delta_real}` : task.delta_real}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border inline-flex items-center gap-1 ${
                        isOverridden
                          ? 'bg-purple-950 text-purple-300 border-purple-800'
                          : task.status === 'Reconciled_Match'
                          ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                          : task.status === 'Completed'
                          ? 'bg-blue-950 text-blue-300 border-blue-800'
                          : 'bg-amber-950 text-amber-300 border-amber-800'
                      }`}>
                        {isLocked && <Lock className="w-2.5 h-2.5" />}
                        <span>{task.status}</span>
                      </span>
                      {task.override_reason && (
                        <div className="text-[10px] text-slate-400 mt-0.5 max-w-xs truncate font-sans">
                          {task.override_reason}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenOverride(task)}
                          className="px-2.5 py-1 text-[11px] font-bold text-white bg-amber-600 hover:bg-amber-500 rounded transition-colors cursor-pointer shadow-2xs"
                        >
                          Forzar Override
                        </button>
                        {isLocked && (
                          <button
                            onClick={() => {
                              setUnlockSkuCode(task.sku_code);
                              setUnlockDepositCode(task.deposit_code);
                              setShowUnlockModal(true);
                            }}
                            className="p-1 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition-colors cursor-pointer"
                            title="Desbloquear SKU"
                          >
                            <Unlock className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: RECONCILIACIÓN FORZADA (override-task) */}
      {showOverrideModal && targetTask && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Reconciliación Forzada de Tarea</h3>
                  <div className="text-xs font-mono text-amber-400">POST /api/v1/admin/override-task</div>
                </div>
              </div>
              <button
                onClick={() => setShowOverrideModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitOverride} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Tarea ID:</span>
                  <span className="font-mono text-white">#{targetTask.id}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>SKU Code:</span>
                  <span className="font-mono text-emerald-400 font-bold">{targetTask.sku_code}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Depósito:</span>
                  <span className="font-mono text-white">{targetTask.deposit_code}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Teórico ERP (S):</span>
                  <span className="font-mono text-white">{targetTask.system_quantity}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Ventas Durante Conteo (V):</span>
                  <span className="font-mono text-white">{targetTask.sales_during_audit}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Cantidad Forzada Reconciliada (forced_quantity):
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={forcedQuantity}
                  onChange={(e) => setForcedQuantity(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full px-3 py-2 text-sm font-mono font-bold bg-slate-950 border border-slate-700 rounded-lg text-emerald-400 outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Motivo Forense de la Reconciliación (reason):
                </label>
                <textarea
                  rows={3}
                  required
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Explica la causa física o contable (merma natural, rotura certificada, error de bulto...)"
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-white outline-none focus:border-amber-400 resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowOverrideModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingOverride}
                  className="px-4 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors cursor-pointer disabled:opacity-50 shadow-sm flex items-center gap-1.5"
                >
                  {isSubmittingOverride ? 'Guardando Override...' : 'Confirmar Override Inmutable'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: DESBLOQUEO DE SKU (unlock-sku) */}
      {showUnlockModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Unlock className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Desbloquear SKU</h3>
              </div>
              <button onClick={() => setShowUnlockModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitUnlock} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">SKU Code:</label>
                <input
                  type="text"
                  required
                  value={unlockSkuCode}
                  onChange={(e) => setUnlockSkuCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-950 border border-slate-700 rounded-lg text-white outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Depósito:</label>
                <select
                  value={unlockDepositCode}
                  onChange={(e) => setUnlockDepositCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-white outline-none focus:border-amber-400"
                >
                  <option value="150101">150101 - Almacén</option>
                  <option value="150103">150103 - Piso de Venta</option>
                  <option value="150102">150102 - Avería</option>
                  <option value="150107">150107 - Galpón</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowUnlockModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingUnlock}
                  className="px-4 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg cursor-pointer"
                >
                  {isSubmittingUnlock ? 'Desbloqueando...' : 'Desbloquear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: SINCRONIZACIÓN PRIORITARIA (sync-now) */}
      {showSyncModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <RotateCw className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Sincronización Prioritaria (Sync Now)</h3>
              </div>
              <button onClick={() => setShowSyncModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitSyncNow} className="space-y-4">
              <p className="text-xs text-slate-400">
                Inyecta una orden prioritaria al frente de la cola FIFO del Relay Agent para consultar el stock físico de este SKU en todos los depósitos.
              </p>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">SKU Code:</label>
                <input
                  type="text"
                  required
                  value={syncSkuCode}
                  onChange={(e) => setSyncSkuCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-950 border border-slate-700 rounded-lg text-emerald-300 outline-none focus:border-emerald-400"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSyncModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSync}
                  className="px-4 py-2 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg cursor-pointer"
                >
                  {isSubmittingSync ? 'Encolando...' : 'Sincronizar Ahora'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
