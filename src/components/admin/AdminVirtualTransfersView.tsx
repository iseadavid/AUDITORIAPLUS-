/**
 * M3: Traslados Virtuales (/admin/traslados)
 * AUDITORIAPLUS+ Superuser Desktop Cockpit (1920x1080)
 * 
 * Monitor de compensaciones en el Nodo de Tránsito Virtual (150104):
 * - Visualización de transferencias sugeridas (Suggested), en espera de ERP (Pending_ERP_Confirmation) y ejecutadas (Executed).
 * - Balance de compensación virtual entre depósitos (ej. Almacén 150101 faltante -5 y Piso 150103 sobrante +6 -> 5 uds en 150104).
 * - Confirmación manual o automática por Worker 2.
 */

import React, { useState } from 'react';
import { useAuditStore } from '../../store/useAuditStore';
import { ReadVirtualTransfer } from '../../types/clientContracts';
import { 
  GitCompare, 
  ArrowRight, 
  ShieldCheck, 
  Clock, 
  CheckCircle2, 
  Building2, 
  Zap, 
  Boxes, 
  RotateCw,
  Search,
  ExternalLink,
  ChevronRight,
  Sparkles
} from 'lucide-react';

export const AdminVirtualTransfersView: React.FC = () => {
  const { virtualTransfers, confirmTransferAction } = useAuditStore();
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isSimulatingWorker2, setIsSimulatingWorker2] = useState<boolean>(false);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);

  const filteredTransfers = virtualTransfers.filter(tr => {
    const matchesSearch = tr.sku_code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || tr.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const totalTransitUnits = virtualTransfers
    .filter(t => t.status === 'Suggested' || t.status === 'Pending_ERP_Confirmation')
    .reduce((sum, t) => sum + t.quantity_to_move, 0);

  const executedTransfers = virtualTransfers.filter(t => t.status === 'Executed');
  const pendingErpTransfers = virtualTransfers.filter(t => t.status === 'Pending_ERP_Confirmation');
  const suggestedTransfers = virtualTransfers.filter(t => t.status === 'Suggested');

  // Trigger Worker 2 manual simulation
  const handleRunWorker2Simulation = async () => {
    setIsSimulatingWorker2(true);
    setStatusNotification(null);

    // Simulate 15-minute polling loop checking MaraPlus ERP
    setTimeout(async () => {
      for (const tr of pendingErpTransfers) {
        await confirmTransferAction(tr.id);
      }
      setIsSimulatingWorker2(false);
      setStatusNotification('Worker 2 ejecutado: Stock verificado en MaraPlus API. Transferencias pendientes marcadas como Executed.');
      setTimeout(() => setStatusNotification(null), 5000);
    }, 1200);
  };

  const handleManualConfirm = async (id: number) => {
    await confirmTransferAction(id);
    setStatusNotification(`Transferencia #${id} confirmada y ejecutada en ERP.`);
    setTimeout(() => setStatusNotification(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Route & Sub-header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-purple-400 bg-purple-950/60 border border-purple-800/60 px-2 py-0.5 rounded">
              M3: TRASLADOS VIRTUALES
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-xs font-mono text-slate-400">/admin/traslados</span>
            <span className="text-slate-600">·</span>
            <span className="text-xs text-purple-300 font-mono">Nodo de Tránsito Virtual: 150104</span>
          </div>
          <h2 className="text-xl font-bold text-white mt-1">
            Monitor de Compensaciones Cruzadas & Neutralización de Mermas
          </h2>
          <p className="text-xs text-slate-400">
            Algoritmo <code className="text-purple-300 font-mono">evaluateVirtualCompensations</code>: Si un SKU presenta faltante en un depósito y sobrante en otro, se sugiere el traspaso al Nodo 150104 sin alertar merma real.
          </p>
        </div>

        {/* Worker 2 Execution Button */}
        <div className="flex items-center gap-2 self-start xl:self-auto">
          <button
            onClick={handleRunWorker2Simulation}
            disabled={isSimulatingWorker2 || pendingErpTransfers.length === 0}
            className="px-4 py-2 text-xs font-bold text-slate-950 bg-purple-400 hover:bg-purple-300 rounded-xl flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            {isSimulatingWorker2 ? (
              <>
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
                <span>Sondeando MaraPlus ERP...</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>Disparar Sondeo Worker 2 (15 Min)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {statusNotification && (
        <div className="p-3.5 rounded-xl bg-purple-950/80 border border-purple-800 text-purple-200 flex items-center justify-between gap-3 text-xs font-mono shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
            <span>{statusNotification}</span>
          </div>
        </div>
      )}

      {/* Visual Topology Diagram: Nodo de Tránsito Virtual 150104 */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-6 shadow-md relative overflow-hidden">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Boxes className="w-5 h-5 text-purple-400" />
            <h3 className="text-sm font-bold text-white">
              Arquitectura del Buffer de Tránsito Virtual (Depósito 150104)
            </h3>
          </div>
          <span className="text-xs font-mono text-purple-300 bg-purple-950/80 px-2.5 py-1 rounded border border-purple-800">
            {totalTransitUnits} Unidades Flotantes en Tránsito
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 items-center">
          {/* Box 1: Depósito Origen (+Δ Sobrante) */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-center relative group hover:border-blue-500/40 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 mx-auto flex items-center justify-center font-bold text-xs">
              +Δ
            </div>
            <div className="text-sm font-bold text-white">Depósito Origen con Sobrante</div>
            <p className="text-xs text-slate-400">
              Piso de Venta (150103) o Galpón (150107) con unidades no registradas en ventas inmediatas.
            </p>
            <div className="text-xs font-mono text-blue-400 pt-1">FromDeposit = '150103'</div>
          </div>

          {/* Central Buffer: Nodo Virtual 150104 */}
          <div className="p-5 rounded-xl bg-purple-950/40 border-2 border-purple-500/50 space-y-2 text-center relative shadow-lg">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-300 mx-auto flex items-center justify-center font-black text-sm">
              150104
            </div>
            <div className="text-sm font-black text-white">Nodo de Tránsito Virtual</div>
            <p className="text-xs text-purple-200/80">
              Mantiene las unidades en custodia virtual mientras el ERP procesa el traspaso.
            </p>
            <div className="text-xs font-mono text-emerald-400 font-bold bg-purple-950 py-1 rounded">
              Evita Mermas Falsas en la Auditoría
            </div>
          </div>

          {/* Box 3: Depósito Destino (-Δ Faltante) */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-center relative group hover:border-emerald-500/40 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center font-bold text-xs">
              -Δ
            </div>
            <div className="text-sm font-bold text-white">Depósito Destino con Faltante</div>
            <p className="text-xs text-slate-400">
              Almacén Central (150101) con descalce cubierto por la mercadería en tránsito.
            </p>
            <div className="text-xs font-mono text-emerald-400 pt-1">ToDeposit = '150101'</div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl shadow-xs">
          <div className="text-xs text-slate-400 font-medium">Sugeridas por Algoritmo</div>
          <div className="text-2xl font-black text-amber-400 font-mono mt-1 tabular-nums">
            {suggestedTransfers.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Pendientes de envío a MaraPlus ERP
          </div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl shadow-xs">
          <div className="text-xs text-slate-400 font-medium">Pendientes Confirmación ERP</div>
          <div className="text-2xl font-black text-purple-400 font-mono mt-1 tabular-nums">
            {pendingErpTransfers.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Monitoreadas cada 15 min por Worker 2
          </div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl shadow-xs">
          <div className="text-xs text-slate-400 font-medium">Transferencias Confirmadas</div>
          <div className="text-2xl font-black text-emerald-400 font-mono mt-1 tabular-nums">
            {executedTransfers.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Stock cuadrado y balanceado en ambos depósitos
          </div>
        </div>
      </div>

      {/* Transfers Data Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-950/50">
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              placeholder="Buscar SKU en compensación..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white outline-none focus:border-purple-400 placeholder:text-slate-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
                filterStatus === 'all'
                  ? 'bg-purple-600 text-white font-bold'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              Todos ({virtualTransfers.length})
            </button>
            <button
              onClick={() => setFilterStatus('Suggested')}
              className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
                filterStatus === 'Suggested'
                  ? 'bg-amber-600 text-white font-bold'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              Suggested
            </button>
            <button
              onClick={() => setFilterStatus('Pending_ERP_Confirmation')}
              className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
                filterStatus === 'Pending_ERP_Confirmation'
                  ? 'bg-purple-600 text-white font-bold'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              Pending ERP
            </button>
            <button
              onClick={() => setFilterStatus('Executed')}
              className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
                filterStatus === 'Executed'
                  ? 'bg-emerald-600 text-white font-bold'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              Executed
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Origen (Sobrante)</th>
                <th className="px-4 py-3">Nodo de Tránsito</th>
                <th className="px-4 py-3">Destino (Faltante)</th>
                <th className="px-4 py-3">Cantidad</th>
                <th className="px-4 py-3">ERP Movement ID</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-mono">
              {filteredTransfers.map((tr) => (
                <tr key={tr.id} className="hover:bg-slate-800/40">
                  <td className="px-4 py-3 text-slate-500">#{tr.id}</td>
                  <td className="px-4 py-3 text-white font-bold">{tr.sku_code}</td>
                  <td className="px-4 py-3 text-blue-300">
                    <span className="bg-blue-950/60 px-2 py-0.5 rounded border border-blue-900">
                      {tr.from_deposit}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-purple-300 font-bold">
                    <span className="bg-purple-950 px-2 py-0.5 rounded border border-purple-800">
                      {tr.transit_deposit}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-emerald-300">
                    <span className="bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-900">
                      {tr.to_deposit}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white font-bold text-sm">
                    {tr.quantity_to_move} uds
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {tr.erp_movement_id || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border inline-flex items-center gap-1 ${
                      tr.status === 'Executed'
                        ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                        : tr.status === 'Pending_ERP_Confirmation'
                        ? 'bg-purple-950 text-purple-300 border-purple-800'
                        : 'bg-amber-950 text-amber-300 border-amber-800'
                    }`}>
                      {tr.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {tr.status !== 'Executed' ? (
                      <button
                        onClick={() => handleManualConfirm(tr.id)}
                        className="px-2.5 py-1 text-[11px] font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded transition-colors cursor-pointer"
                      >
                        Confirmar
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-500 font-sans">
                        ✓ Confirmado
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
