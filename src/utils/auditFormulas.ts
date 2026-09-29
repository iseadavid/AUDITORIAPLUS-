// ==============================================================================
// AUDITORIAPLUS+ Formulas, Multipliers & Audio Beep Engine
// ==============================================================================

export interface DepositConfig {
  code: string;
  name: string;
  description: string;
  multiplier: number; // K_Ubicacion
  badgeColor: string;
}

export const DEPOSIT_CONFIGS: Record<string, DepositConfig> = {
  '150101': {
    code: '150101',
    name: 'Almacén Principal',
    description: 'Estanterías altas y racks de reserva',
    multiplier: 1.4,
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  '150103': {
    code: '150103',
    name: 'Piso de Venta',
    description: 'Góndolas, anaqueles y exhibidores públicos',
    multiplier: 1.0,
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  '150102': {
    code: '150102',
    name: 'Avería / Merma',
    description: 'Zona de productos dañados o próximos a vencer',
    multiplier: 1.2,
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  '150107': {
    code: '150107',
    name: 'Galpón / Reserva',
    description: 'Bodega externa y almacenamiento de bultos',
    multiplier: 1.3,
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
  },
};

/**
 * Obtiene el multiplicador K_Ubicacion según el código de depósito
 */
export function getDepositMultiplier(depositCode: string): number {
  return DEPOSIT_CONFIGS[depositCode]?.multiplier || 1.0;
}

/**
 * Redondeo Financiero estricto IEEE 754:
 * Math.round((precioBase * (1 + impuestoPct / 100) + Number.EPSILON) * 100) / 100
 */
export function calculatePVP(precioBase: number, impuestoPct: number = 16.0): number {
  return Math.round((precioBase * (1 + impuestoPct / 100) + Number.EPSILON) * 100) / 100;
}

/**
 * Cálculo transparente de discrepancia:
 * ΔReal = C - (S - V)
 */
export function calculateDeltaReal(C: number, S: number, V: number): {
  effectiveTheoretical: number;
  deltaReal: number;
  isMatch: boolean;
} {
  const effectiveTheoretical = S - V;
  const deltaReal = C - effectiveTheoretical;
  return {
    effectiveTheoretical,
    deltaReal,
    isMatch: deltaReal === 0,
  };
}

/**
 * Cálculo de Gamificación y XP Live:
 * XP = (C * 10 * K_Ubicación) + BonusRacha + BonusVerificación
 * (Sin penalizaciones ni restas de puntos)
 */
export function calculateXP(params: {
  countedQty: number;
  depositCode: string;
  currentStreak: number;
  isMatch: boolean;
}): {
  baseXP: number;
  streakBonus: number;
  verificationBonus: number;
  totalXP: number;
  multiplier: number;
} {
  const K = getDepositMultiplier(params.depositCode);
  const baseXP = Math.round(params.countedQty * 10 * K);

  // Bonus Racha (progresivo por conteos consecutivos exactos)
  let streakBonus = 0;
  if (params.currentStreak >= 10) streakBonus = 100;
  else if (params.currentStreak >= 5) streakBonus = 50;
  else if (params.currentStreak >= 3) streakBonus = 25;

  // Bonus Verificación (Match exacto ΔReal = 0)
  const verificationBonus = params.isMatch ? 50 : 0;

  const totalXP = baseXP + streakBonus + verificationBonus;

  return {
    baseXP,
    streakBonus,
    verificationBonus,
    totalXP,
    multiplier: K,
  };
}

/**
 * Normaliza y expande códigos de barra mediante LPAD(input, 6, '0')
 * Permite resolver tanto códigos cortos de 6 dígitos como códigos EAN-13 completos
 */
export function normalizeBarcodeInput(rawInput: string): {
  raw: string;
  padded6: string;
  candidates: string[];
} {
  const raw = rawInput.trim();
  const digitsOnly = raw.replace(/\D/g, '');
  const padded6 = digitsOnly.length <= 6 ? digitsOnly.padStart(6, '0') : digitsOnly;

  const candidates = Array.from(new Set([raw, digitsOnly, padded6]));
  return {
    raw,
    padded6,
    candidates,
  };
}

/**
 * Nivel del Auditor según XP acumulado (Gamificación Constructiva)
 */
export function getAuditorTier(xp: number): {
  tier: 'Bronce' | 'Plata' | 'Oro' | 'Platino';
  color: string;
  badgeBg: string;
  nextTierXP: number;
  progressPercent: number;
} {
  if (xp >= 4000) {
    return {
      tier: 'Platino',
      color: 'text-cyan-700 font-bold',
      badgeBg: 'bg-cyan-50 border-cyan-300 text-cyan-800',
      nextTierXP: 10000,
      progressPercent: 100,
    };
  }
  if (xp >= 1500) {
    return {
      tier: 'Oro',
      color: 'text-amber-700 font-bold',
      badgeBg: 'bg-amber-50 border-amber-300 text-amber-800',
      nextTierXP: 4000,
      progressPercent: Math.round(((xp - 1500) / 2500) * 100),
    };
  }
  if (xp >= 500) {
    return {
      tier: 'Plata',
      color: 'text-slate-700 font-bold',
      badgeBg: 'bg-slate-100 border-slate-300 text-slate-800',
      nextTierXP: 1500,
      progressPercent: Math.round(((xp - 500) / 1000) * 100),
    };
  }
  return {
    tier: 'Bronce',
    color: 'text-amber-900 font-bold',
    badgeBg: 'bg-orange-50 border-orange-200 text-amber-900',
    nextTierXP: 500,
    progressPercent: Math.round((xp / 500) * 100),
  };
}

/**
 * Efectos de sonido sintetizados mediante Web Audio API
 * (Proporciona feedback auditivo tipo escáner industrial sin dependencias externas)
 */
export function playAuditorBeep(type: 'scan' | 'match' | 'discrepancy' | 'blocked'): void {
  if (typeof window === 'undefined') return;

  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === 'scan') {
      // Beep corto de lectura láser (1800 Hz)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1800, now);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === 'match') {
      // Doble tono ascendente armónico (Match exacto!)
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1760, now + 0.15);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.start(now);
      osc.stop(now + 0.22);
    } else if (type === 'discrepancy') {
      // Tono de atención Ámbar
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(330, now + 0.1);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'blocked') {
      // Alerta de bloqueo (Tono grave 220 Hz)
      osc.type = 'square';
      osc.frequency.setValueAtTime(220, now);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    }
  } catch (e) {
    // Si el navegador tiene políticas estrictas de audio, se omite silenciosamente
  }
}
