import React, { useState } from 'react';
import { useAuditStore } from '../../store/useAuditStore';
import { 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  Sparkles, 
  Filter, 
  ArrowRight, 
  Calendar,
  Wifi,
  WifiOff,
  Database
} from 'lucide-react';

export const AuditHistoryView: React.FC = () => {
  const { shiftHistory, currentMissionId, currentDepositCode, setAuditorTab } = useAuditStore();
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'match' | 'discrepancy'>('all');

  const filteredHistory = shiftHistory.filter(item => {
    const matchesSearch = 
      item.skuCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.skuName.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (statusFilter === 'match') return matchesSearch && item.status === 'Reconciled_Match';
    if (statusFilter === 'discrepancy') return matchesSearch && item.status === 'Discrepancy_Pending_Review';
    return matchesSearch;
  });

  const totalShiftXP = shiftHistory.reduce((sum, item) => sum + item.earnedXP, 0);
  const totalMatches = shiftHistory.filter(item => item.status === 'Reconciled_Match').length;
  const accuracyPercent = shiftHistory.length > 0 
    ? Math.round((totalMatches / shiftHistory.length) * 100) 
    : 100;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* View Header */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#263988]">
              V4: Registros del Turno de Auditoría
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-xs text-slate-500 font-mono">
              /misiones/{currentMissionId || 'MIS-2026-001'}/historial
            </span>
          </div>
          <h2 className="text-lg font-bold text-slate-900 mt-1">
            Historial de Conteos del Turno
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Registro cronológico de productos escaneados, variaciones netas $\Delta_{'{'}Real{'}'}$ y puntos XP obtenidos.
          </p>
        </div>

        <button
          onClick={() => setAuditorTab('scan')}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#009045] hover:bg-[#007b3b] rounded-lg transition-colors cursor-pointer shadow-xs self-start md:self-auto"
        >
          <span>Continuar Escaneando</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* KPI Cards of Current Shift */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Conteos Registrados</div>
          <div className="text-lg font-bold text-slate-900 font-mono tabular-nums mt-1">
            {shiftHistory.length} <span className="text-xs text-slate-400 font-normal">productos</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
            Dep: {currentDepositCode || '150101'}
          </div>
        </div>

        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Precisión del Turno</div>
          <div className="text-lg font-bold text-emerald-700 font-mono tabular-nums mt-1">
            {accuracyPercent}%
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {totalMatches} coincidencias exactas
          </div>
        </div>

        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Total XP Ganado</div>
          <div className="text-lg font-bold text-[#263988] font-mono tabular-nums mt-1 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-500 fill-amber-500" />
            <span>+{totalShiftXP.toLocaleString()} XP</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Sin deducciones ni penalizaciones
          </div>
        </div>

        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Discrepancias</div>
          <div className="text-lg font-bold text-amber-600 font-mono tabular-nums mt-1">
            {shiftHistory.length - totalMatches}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Reportadas a compensación 150104
          </div>
        </div>
      </div>

      {/* History Table Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Filter & Search Bar */}
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              placeholder="Buscar por SKU o descripción..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg outline-none focus:border-[#263988]"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500">Filtrar:</span>
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-[#263988] text-white font-bold'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              Todos ({shiftHistory.length})
            </button>
            <button
              onClick={() => setStatusFilter('match')}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                statusFilter === 'match'
                  ? 'bg-[#009045] text-white font-bold'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              Match (Δ=0)
            </button>
            <button
              onClick={() => setStatusFilter('discrepancy')}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                statusFilter === 'discrepancy'
                  ? 'bg-amber-600 text-white font-bold'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              Discrepancias
            </button>
          </div>
        </div>

        {/* Table rows */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold tracking-wider border-b border-slate-100">
              <tr>
                <th className="px-4 py-3">Hora</th>
                <th className="px-4 py-3">Producto / SKU</th>
                <th className="px-4 py-3 text-right">Físico (C)</th>
                <th className="px-4 py-3 text-right">Teórico (S - V)</th>
                <th className="px-4 py-3 text-right">ΔReal</th>
                <th className="px-4 py-3 text-right">PVP (IEEE 754)</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">XP Obtenido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400 font-sans text-xs">
                    No hay registros que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                filteredHistory.map(item => {
                  const isMatch = item.status === 'Reconciled_Match';
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 text-slate-400 text-[11px] whitespace-nowrap">
                        {item.timestamp}
                      </td>
                      <td className="px-4 py-3 font-sans">
                        <div className="font-bold text-slate-900 leading-snug">{item.skuName}</div>
                        <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5 mt-0.5">
                          <span>SKU: {item.skuCode}</span>
                          <span>·</span>
                          <span>Depósito: {item.depositCode}</span>
                          {item.isOffline && (
                            <span className="text-amber-700 bg-amber-50 px-1 py-0.2 rounded border border-amber-200 text-[10px]">
                              Offline
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900 tabular-nums">
                        {item.countedQty}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600 tabular-nums">
                        {item.systemQty - item.salesQty} <span className="text-[10px] text-slate-400">({item.systemQty}-{item.salesQty})</span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-bold">
                        {isMatch ? (
                          <span className="text-[#009045]">0</span>
                        ) : item.deltaReal > 0 ? (
                          <span className="text-amber-600">+{item.deltaReal}</span>
                        ) : (
                          <span className="text-rose-600">{item.deltaReal}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700 tabular-nums font-semibold">
                        ${item.pvp.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 font-sans">
                        {isMatch ? (
                          <span className="text-[11px] font-bold text-[#009045] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Reconciled Match
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            Discrepancia
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-[#263988] tabular-nums whitespace-nowrap">
                        +{item.earnedXP} XP
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
