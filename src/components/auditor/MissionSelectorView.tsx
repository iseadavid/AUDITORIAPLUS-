import React, { useState } from 'react';
import { useAuditStore } from '../../store/useAuditStore';
import { DEPOSIT_CONFIGS } from '../../utils/auditFormulas';
import { 
  Building2, 
  Layers, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  Zap, 
  ChevronRight,
  ShieldCheck,
  Calendar
} from 'lucide-react';

interface MissionDefinition {
  id: string;
  code: string;
  title: string;
  branch: string;
  scheduledDate: string;
  priority: 'Alta' | 'Normal';
  subMissions: Array<{
    depositCode: string;
    totalTasks: number;
    completedTasks: number;
    pendingTasks: number;
  }>;
}

const AVAILABLE_MISSIONS: MissionDefinition[] = [
  {
    id: 'MIS-2026-001',
    code: 'MIS-2026-001',
    title: 'Auditoría Cíclica Semanal - Sucursal Central',
    branch: 'Sucursal 15 - San Cristóbal Centro',
    scheduledDate: '29 Sep 2026',
    priority: 'Alta',
    subMissions: [
      { depositCode: '150101', totalTasks: 45, completedTasks: 28, pendingTasks: 17 }, // Almacén 1.4x
      { depositCode: '150103', totalTasks: 60, completedTasks: 50, pendingTasks: 10 }, // Piso 1.0x
      { depositCode: '150102', totalTasks: 18, completedTasks: 12, pendingTasks: 6 },  // Avería 1.2x
      { depositCode: '150107', totalTasks: 30, completedTasks: 5, pendingTasks: 25 },  // Galpón 1.3x
    ],
  },
  {
    id: 'MIS-2026-002',
    code: 'MIS-2026-002',
    title: 'Auditoría Focalizada - Medicamentos de Alto Valor',
    branch: 'Sucursal 15 - San Cristóbal Centro',
    scheduledDate: '29 Sep 2026',
    priority: 'Alta',
    subMissions: [
      { depositCode: '150101', totalTasks: 22, completedTasks: 19, pendingTasks: 3 },
      { depositCode: '150103', totalTasks: 35, completedTasks: 15, pendingTasks: 20 },
    ],
  },
];

export const MissionSelectorView: React.FC = () => {
  const { currentMissionId, currentDepositCode, setSession, userAuth } = useAuditStore();
  const [selectedMissionId, setSelectedMissionId] = useState<string>(currentMissionId || 'MIS-2026-001');

  const activeMission = AVAILABLE_MISSIONS.find(m => m.id === selectedMissionId) || AVAILABLE_MISSIONS[0];

  const handleSelectDeposit = (depositCode: string) => {
    if (!userAuth) return;
    // Guarda la selección en useAuditStore y redirige a escaneo
    setSession(selectedMissionId, depositCode, userAuth);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* View Header */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#263988]">
              V0: Selección de Misión & Depósito
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-xs text-slate-500 font-mono">/misiones</span>
          </div>
          <h2 className="text-lg font-bold text-slate-900 mt-1">
            Misiones de Auditoría Asignadas
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Selecciona el depósito operativo para comenzar el conteo físico. Cada depósito cuenta con un multiplicador de XP según la complejidad de la ubicación.
          </p>
        </div>

        {/* Mission Switcher */}
        <div className="flex items-center gap-2">
          {AVAILABLE_MISSIONS.map(m => (
            <button
              key={m.id}
              onClick={() => setSelectedMissionId(m.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer border ${
                selectedMissionId === m.id
                  ? 'bg-[#263988] text-white border-[#263988] shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {m.code}
            </button>
          ))}
        </div>
      </div>

      {/* Selected Mission Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-[#263988]">
                {activeMission.code}
              </span>
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {activeMission.scheduledDate}
              </span>
              <span className="text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                Prioridad {activeMission.priority}
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900">
              {activeMission.title}
            </h3>
            <p className="text-xs text-slate-500">
              {activeMission.branch}
            </p>
          </div>
        </div>

        {/* Sub-Missions by Deposit Grid */}
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#263988]" />
              <span>Sub-Misiones por Depósito (Selecciona para Escanear)</span>
            </h4>
            <span className="text-xs text-slate-400 font-mono">
              /misiones/{activeMission.code}/deposito
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {activeMission.subMissions.map(sub => {
              const config = DEPOSIT_CONFIGS[sub.depositCode] || {
                code: sub.depositCode,
                name: `Depósito ${sub.depositCode}`,
                description: 'Zona física de almacenamiento',
                multiplier: 1.0,
                badgeColor: 'bg-slate-100 text-slate-700 border-slate-300',
              };

              const progress = Math.round((sub.completedTasks / sub.totalTasks) * 100);
              const isCurrentSession = currentMissionId === activeMission.id && currentDepositCode === sub.depositCode;

              return (
                <div
                  key={sub.depositCode}
                  onClick={() => handleSelectDeposit(sub.depositCode)}
                  className={`group relative p-4 rounded-xl border transition-all cursor-pointer ${
                    isCurrentSession
                      ? 'border-[#263988] ring-2 ring-[#263988]/15 bg-blue-50/20'
                      : 'border-slate-200 hover:border-slate-300 hover:shadow-sm bg-white'
                  }`}
                >
                  {/* Top Bar: Code, Multiplier Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-slate-900">
                          {config.code}
                        </span>
                        <span className="text-slate-300">·</span>
                        <h5 className="text-sm font-bold text-slate-900 group-hover:text-[#263988] transition-colors">
                          {config.name}
                        </h5>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                        {config.description}
                      </p>
                    </div>

                    {/* Exact Multiplier Badges Required */}
                    <div className="shrink-0 flex items-center gap-1.5">
                      <span className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg border flex items-center gap-1 shadow-2xs ${config.badgeColor}`}>
                        <Zap className="w-3.5 h-3.5 fill-current" />
                        <span>{config.multiplier.toFixed(1)}x XP</span>
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar & Stats */}
                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-500">
                        {sub.completedTasks} / {sub.totalTasks} tareas ({progress}%)
                      </span>
                      <span className="font-semibold text-slate-700">
                        {sub.pendingTasks} pendientes
                      </span>
                    </div>

                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#009045] transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Select CTA Button */}
                  <div className="mt-3.5 flex items-center justify-between pt-2">
                    <span className="text-[11px] text-slate-400 font-sans">
                      {isCurrentSession ? '✓ Sesión actualmente activa' : 'Toca para iniciar conteo'}
                    </span>

                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#009045] hover:bg-[#007b3b] rounded-lg shadow-2xs transition-colors cursor-pointer group-hover:translate-x-0.5 transition-transform"
                    >
                      <span>Auditar Depósito</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
