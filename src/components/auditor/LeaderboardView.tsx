import React from 'react';
import { useAuditStore } from '../../store/useAuditStore';
import { getAuditorTier } from '../../utils/auditFormulas';
import { 
  Trophy, 
  Flame, 
  Medal, 
  Sparkles, 
  CheckCircle2, 
  TrendingUp, 
  ShieldCheck, 
  Crown,
  Zap,
  ArrowRight
} from 'lucide-react';

interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  role: string;
  totalXP: number;
  streak: number;
  totalCounts: number;
  accuracyRate: number;
  isCurrentUser?: boolean;
}

export const LeaderboardView: React.FC = () => {
  const { userXP, currentStreak, totalCountsDone, userAuth, currentMissionId, setAuditorTab } = useAuditStore();

  const currentTier = getAuditorTier(userXP);

  // Leaderboard data with constructive positive scoring (No deductions / no negative points)
  const leaderboardData: LeaderboardEntry[] = [
    {
      rank: 1,
      userId: 'usr-001',
      name: 'María Valentina Soto',
      role: 'Auditor Senior',
      totalXP: 5480,
      streak: 12,
      totalCounts: 88,
      accuracyRate: 99.1,
    },
    {
      rank: 2,
      userId: 'usr-002',
      name: 'Alejandro Colmenares',
      role: 'Auditor Especialista',
      totalXP: 3820,
      streak: 7,
      totalCounts: 64,
      accuracyRate: 98.7,
    },
    {
      rank: 3,
      userId: userAuth?.userId || 'usr-auditor-101',
      name: `${userAuth?.displayName || userAuth?.username || 'Carlos Auditor'} (Tú)`,
      role: 'Auditor de Campo',
      totalXP: userXP,
      streak: currentStreak,
      totalCounts: totalCountsDone,
      accuracyRate: 98.4,
      isCurrentUser: true,
    },
    {
      rank: 4,
      userId: 'usr-004',
      name: 'Daniela Briceño',
      role: 'Auditor Operativo',
      totalXP: 1240,
      streak: 3,
      totalCounts: 30,
      accuracyRate: 97.5,
    },
    {
      rank: 5,
      userId: 'usr-005',
      name: 'Roberto Gómez',
      role: 'Auditor Junior',
      totalXP: 450,
      streak: 1,
      totalCounts: 14,
      accuracyRate: 96.0,
    },
  ];

  // Re-sort dynamically according to totalXP
  leaderboardData.sort((a, b) => b.totalXP - a.totalXP);
  leaderboardData.forEach((item, idx) => {
    item.rank = idx + 1;
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* View Header */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#263988]">
              V5: Leaderboard & Niveles
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-xs text-slate-500 font-mono">
              /misiones/{currentMissionId || 'MIS-2026-001'}/ranking
            </span>
          </div>
          <h2 className="text-lg font-bold text-slate-900 mt-1">
            Tabla de Posiciones de Auditores
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Gamificación constructiva: acumulación de XP por conteos, rachas de precisión y multiplicadores de depósito (sin penalizaciones ni restas).
          </p>
        </div>

        <button
          onClick={() => setAuditorTab('scan')}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#009045] hover:bg-[#007b3b] rounded-lg transition-colors cursor-pointer shadow-xs self-start md:self-auto"
        >
          <span>Escanear y Ganar XP</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* User Current Tier Status Card */}
      <div className="bg-gradient-to-r from-[#263988] to-[#1d2d6d] rounded-2xl p-6 text-white shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white/15 text-emerald-300 border border-white/20">
                Tu Nivel Actual: {currentTier.tier}
              </span>
              <span className="text-blue-200 text-xs">·</span>
              <span className="text-xs text-blue-200 font-mono">
                {currentStreak} conteos en racha
              </span>
            </div>
            <h3 className="text-2xl font-black tracking-tight">
              {userXP.toLocaleString()} Puntos de Experiencia (XP)
            </h3>
            <p className="text-xs text-blue-100/80 max-w-lg leading-relaxed">
              Estás a solo <strong className="text-white font-mono">{Math.max(0, currentTier.nextTierXP - userXP)} XP</strong> de alcanzar el siguiente escalafón. 
              Recuerda que auditar en <strong>Almacén (150101)</strong> te otorga <strong>1.4x XP</strong> y cada Match exacto suma <strong>+50 XP</strong>.
            </p>
          </div>

          <div className="shrink-0 bg-white/10 p-4 rounded-xl border border-white/15 backdrop-blur-xs text-center min-w-[160px]">
            <Trophy className="w-8 h-8 text-amber-400 mx-auto" />
            <div className="text-xs text-blue-200 uppercase font-bold mt-1">Nivel Oficial</div>
            <div className="text-lg font-black text-white">{currentTier.tier}</div>
            <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden mt-2">
              <div
                className="h-full bg-emerald-400"
                style={{ width: `${Math.min(100, currentTier.progressPercent)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Leaderboard Table Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            <span>Ranking General del Turno</span>
          </h4>
          <span className="text-xs text-slate-500 font-mono">
            {leaderboardData.length} auditores activos
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold tracking-wider border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 w-14 text-center">Pos.</th>
                <th className="px-4 py-3">Auditor</th>
                <th className="px-4 py-3">Nivel</th>
                <th className="px-4 py-3 text-right">Racha</th>
                <th className="px-4 py-3 text-right">Conteos</th>
                <th className="px-4 py-3 text-right">Precisión</th>
                <th className="px-4 py-3 text-right">Total XP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {leaderboardData.map(entry => {
                const tier = getAuditorTier(entry.totalXP);
                return (
                  <tr
                    key={entry.userId}
                    className={`transition-colors ${
                      entry.isCurrentUser
                        ? 'bg-blue-50/50 font-semibold'
                        : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <td className="px-4 py-3.5 text-center font-bold font-mono">
                      {entry.rank === 1 ? (
                        <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 inline-flex items-center justify-center font-bold text-xs">
                          🥇
                        </span>
                      ) : entry.rank === 2 ? (
                        <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 inline-flex items-center justify-center font-bold text-xs">
                          🥈
                        </span>
                      ) : entry.rank === 3 ? (
                        <span className="w-6 h-6 rounded-full bg-amber-50 text-amber-900 border border-amber-200 inline-flex items-center justify-center font-bold text-xs">
                          🥉
                        </span>
                      ) : (
                        <span className="text-slate-500">#{entry.rank}</span>
                      )}
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div>
                          <div className={`font-bold ${entry.isCurrentUser ? 'text-[#263988]' : 'text-slate-900'}`}>
                            {entry.name}
                          </div>
                          <div className="text-[11px] text-slate-500">{entry.role}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${tier.badgeBg}`}>
                        {tier.tier}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-right font-mono font-bold text-amber-600 tabular-nums">
                      <span className="flex items-center justify-end gap-1">
                        <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                        <span>{entry.streak}</span>
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-right font-mono text-slate-700 tabular-nums">
                      {entry.totalCounts}
                    </td>

                    <td className="px-4 py-3.5 text-right font-mono font-bold text-emerald-700 tabular-nums">
                      {entry.accuracyRate}%
                    </td>

                    <td className="px-4 py-3.5 text-right font-mono font-black text-slate-900 text-sm tabular-nums whitespace-nowrap">
                      {entry.totalXP.toLocaleString()} XP
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Gamification Rules & Escalafón Guide */}
      <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-600" />
          <span>Reglas de Gamificación Constructiva (Sin Penalizaciones)</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
            <div className="font-bold text-slate-900">Nivel Bronce</div>
            <div className="text-slate-500 font-mono">0 a 499 XP</div>
            <p className="text-[11px] text-slate-600 font-sans">
              Etapa inicial de inducción y conteo guiado.
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
            <div className="font-bold text-slate-900">Nivel Plata</div>
            <div className="text-slate-500 font-mono">500 a 1,499 XP</div>
            <p className="text-[11px] text-slate-600 font-sans">
              Auditor regular con ritmo sostenido.
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
            <div className="font-bold text-amber-800">Nivel Oro</div>
            <div className="text-amber-700 font-mono">1,500 a 3,999 XP</div>
            <p className="text-[11px] text-slate-600 font-sans">
              Especialista de alta velocidad y consistencia.
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
            <div className="font-bold text-cyan-800">Nivel Platino</div>
            <div className="text-cyan-700 font-mono">4,000+ XP</div>
            <p className="text-[11px] text-slate-600 font-sans">
              Master Auditor con precisión máxima verificada.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
