import React, { useState, useEffect, useRef } from 'react';
import { useAuditStore, ShiftAuditLogItem } from '../../store/useAuditStore';
import { 
  DEPOSIT_CONFIGS, 
  calculatePVP, 
  calculateDeltaReal, 
  calculateXP, 
  normalizeBarcodeInput, 
  playAuditorBeep 
} from '../../utils/auditFormulas';
import { findSkuByBarcodeOrCode, ReadSkuMaster } from '../../services/offlineDatabase';
import { 
  Scan, 
  Camera, 
  Zap, 
  AlertTriangle, 
  CheckCircle2, 
  Lock, 
  FileEdit, 
  Sparkles, 
  Plus, 
  Minus, 
  ArrowRight, 
  DollarSign, 
  Calculator, 
  Flame, 
  Search, 
  X, 
  Check 
} from 'lucide-react';

export const ScanningInterfaceView: React.FC = () => {
  const { 
    currentMissionId, 
    currentDepositCode, 
    userAuth, 
    isOffline, 
    currentStreak, 
    missionTasks, 
    updateTaskStatus, 
    recordShiftCount, 
    registerOfflineCount,
    setAuditorTab 
  } = useAuditStore();

  const activeDeposit = DEPOSIT_CONFIGS[currentDepositCode || '150101'] || DEPOSIT_CONFIGS['150101'];

  // Scanner Input & Lookup State
  const [barcodeInput, setBarcodeInput] = useState<string>('');
  const [resolutionTimeMs, setResolutionTimeMs] = useState<number | null>(null);
  const [selectedSku, setSelectedSku] = useState<ReadSkuMaster | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [flashlightOn, setFlashlightOn] = useState<boolean>(false);

  // Active Count State
  const [countedQty, setCountedQty] = useState<number>(20);
  const [precioBase, setPrecioBase] = useState<number>(12.50);
  const [impuestoPct, setImpuestoPct] = useState<number>(16.0);

  // Modales de Excepción
  // Modal A: Bloqueo de Re-conteo (Ámbar #F59E0B)
  const [showModalABlocked, setShowModalABlocked] = useState<boolean>(false);
  const [blockedTaskInfo, setBlockedTaskInfo] = useState<{
    auditorName: string;
    closedAt: string;
    countedQty: number;
    skuCode: string;
    skuName: string;
  } | null>(null);

  // Modal B: Ficha Incompleta
  const [showModalBFichaIncompleta, setShowModalBFichaIncompleta] = useState<boolean>(false);
  const [fichaForm, setFichaForm] = useState<{
    description: string;
    category: string;
    presentation: string;
  }>({
    description: '',
    category: 'Medicamentos',
    presentation: 'Caja x 10 Tabletas',
  });

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on input on mount and keep focus
  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, []);

  // Quick Preset Selector helper
  const handleLoadSampleBarcode = (code: string) => {
    setBarcodeInput(code);
    resolveBarcode(code);
  };

  // Barcode Resolution: applies LPAD(input, 6, '0') and resolves in <5ms
  const resolveBarcode = async (input: string) => {
    if (!input.trim()) {
      setSelectedSku(null);
      setResolutionTimeMs(null);
      return;
    }

    const startTime = performance.now();
    const { padded6, candidates } = normalizeBarcodeInput(input);

    let resolved: ReadSkuMaster | undefined = undefined;

    // 1. Check in IndexedDB sku_master_local
    for (const cand of candidates) {
      resolved = await findSkuByBarcodeOrCode(cand);
      if (resolved) break;
    }

    // 2. Fallback to mock dictionary for specialized testing
    if (!resolved) {
      if (input === '004521' || padded6 === '004521') {
        resolved = {
          sku_code: '004521',
          barcode: '004521',
          description: '', // Ficha incompleta! Dispara Modal B
          category: '',
          tax_rate: 16.0,
          is_active: true,
        };
      } else if (input.includes('7593009876543') || input.includes('00104')) {
        resolved = {
          sku_code: '7593009876543',
          barcode: '7593009876543',
          description: 'Paracetamol 650mg x 10 Tabletas',
          category: 'Analgésicos',
          tax_rate: 16.0,
          is_active: true,
        };
      } else {
        resolved = {
          sku_code: input,
          barcode: input,
          description: `Producto SKU #${input}`,
          category: 'Farmacia General',
          tax_rate: 16.0,
          is_active: true,
        };
      }
    }

    const elapsed = parseFloat((performance.now() - startTime).toFixed(2));
    setResolutionTimeMs(elapsed);
    setSelectedSku(resolved);

    // Play scanner laser beep
    playAuditorBeep('scan');

    // VERIFICACIÓN DE EXCEPCIONES:
    // Excepción A: ¿La tupla (MissionId + DepositCode + SkuCode) está en Completed o Reconciled_Match?
    const existingTask = missionTasks.find(
      t => t.sku_code === resolved?.sku_code && t.deposit_code === (currentDepositCode || '150101')
    );

    if (existingTask && (existingTask.status === 'Completed' || existingTask.status === 'Reconciled_Match')) {
      playAuditorBeep('blocked');
      setBlockedTaskInfo({
        auditorName: existingTask.auditor_id || 'marcos.verificador',
        closedAt: existingTask.updated_at.substring(11, 19) || '09:12:00',
        countedQty: Number(existingTask.counted_quantity || existingTask.system_quantity),
        skuCode: resolved.sku_code,
        skuName: resolved.description || existingTask.sku_name || 'Ítem Bloqueado',
      });
      setShowModalABlocked(true);
      return;
    }

    // Excepción B: ¿La ficha técnica del SKU está incompleta?
    const isFichaIncomplete = !resolved?.description || resolved?.description.trim() === '' || !resolved?.category;
    if (isFichaIncomplete) {
      setFichaForm({
        description: '',
        category: 'Antibióticos',
        presentation: 'Caja x 10 Tabletas',
      });
      setShowModalBFichaIncompleta(true);
      return;
    }

    // Preset sensible count
    if (existingTask) {
      setCountedQty(existingTask.system_quantity);
    }
  };

  // Find or create active task associated with this SKU
  const currentTask = missionTasks.find(
    t => t.sku_code === selectedSku?.sku_code && t.deposit_code === (currentDepositCode || '150101')
  ) || {
    id: 999,
    mission_id: currentMissionId || 'MIS-2026-001',
    sku_code: selectedSku?.sku_code || 'N/A',
    sku_name: selectedSku?.description || '',
    deposit_code: currentDepositCode || '150101',
    status: 'Pending_Count' as const,
    system_quantity: 20,
    sales_during_audit: 0,
    counted_quantity: null,
    delta_real: null,
    is_locked: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // V3: Cálculos Matemáticos en Vivo
  // 1. Redondeo Financiero IEEE 754:
  const pvp = calculatePVP(precioBase, impuestoPct);

  // 2. Ecuación Transparente: ΔReal = C - (S - V)
  const { effectiveTheoretical, deltaReal, isMatch } = calculateDeltaReal(
    countedQty,
    currentTask.system_quantity,
    currentTask.sales_during_audit
  );

  // 3. Gamificación Live: XP = (C * 10 * K_Ubicacion) + BonusRacha + BonusVerificacion
  const xpMetrics = calculateXP({
    countedQty,
    depositCode: currentDepositCode || '150101',
    currentStreak,
    isMatch,
  });

  // Guardar ficha completada (Modal B)
  const handleSaveModalBFicha = () => {
    if (!fichaForm.description.trim()) return;

    if (selectedSku) {
      setSelectedSku({
        ...selectedSku,
        description: fichaForm.description.trim(),
        category: fichaForm.category,
        presentation: fichaForm.presentation,
      });
    }
    setShowModalBFichaIncompleta(false);
    barcodeInputRef.current?.focus();
  };

  // Submit Conteo
  const handleSubmitCount = async () => {
    if (!selectedSku) return;

    // Sonido de feedback auditivo según el resultado
    if (isMatch) {
      playAuditorBeep('match');
    } else {
      playAuditorBeep('discrepancy');
    }

    const finalStatus = isMatch ? 'Reconciled_Match' : 'Discrepancy_Pending_Review';

    // 1. Actualizar tarea en Zustand
    updateTaskStatus(currentTask.id, {
      counted_quantity: countedQty,
      delta_real: deltaReal,
      status: finalStatus,
      is_locked: !isMatch, // Bloqueado si hay discrepancia
    });

    // 2. Si está offline o para resiliencia en IndexedDB:
    await registerOfflineCount({
      taskId: currentTask.id,
      skuCode: selectedSku.sku_code,
      countedQuantity: countedQty,
    });

    // 3. Registrar en historial de turno y otorgar XP
    const logItem: ShiftAuditLogItem = {
      id: `shift-${Date.now()}`,
      taskId: currentTask.id,
      skuCode: selectedSku.sku_code,
      skuName: selectedSku.description,
      depositCode: currentDepositCode || '150101',
      systemQty: currentTask.system_quantity,
      salesQty: currentTask.sales_during_audit,
      countedQty,
      deltaReal,
      status: finalStatus,
      earnedXP: xpMetrics.totalXP,
      timestamp: new Date().toLocaleTimeString('es-VE', { hour12: false }),
      pvp,
      isOffline,
    };

    recordShiftCount(logItem);

    // Reset scanner input and refocus
    setBarcodeInput('');
    setSelectedSku(null);
    setResolutionTimeMs(null);
    barcodeInputRef.current?.focus();
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Deposit Location Banner */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-[#263988]">
            <Scan className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900">
                {activeDeposit.name} (Depósito {activeDeposit.code})
              </span>
              <span className="text-slate-300">·</span>
              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                K_Ubicación: {activeDeposit.multiplier.toFixed(1)}x XP
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono">
              Misión: {currentMissionId || 'MIS-2026-001'} · Auditor: {userAuth?.displayName || userAuth?.username}
            </p>
          </div>
        </div>

        <button
          onClick={() => setAuditorTab('selector')}
          className="text-xs font-semibold text-[#263988] hover:underline cursor-pointer"
        >
          Cambiar Depósito / Misión
        </button>
      </div>

      {/* Main Two-Column Viewport: Left Scanner, Right Count & Equation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Scanner (Input + HTML5 Camera Reticle) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-[#263988]" />
                <span>Lectura Láser / Entrada Manual</span>
              </label>

              {resolutionTimeMs !== null && (
                <span className="text-[11px] font-mono font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Resuelto en {resolutionTimeMs}ms
                </span>
              )}
            </div>

            {/* Input with autoFocus */}
            <div className="relative">
              <input
                ref={barcodeInputRef}
                autoFocus
                type="text"
                value={barcodeInput}
                onChange={e => {
                  setBarcodeInput(e.target.value);
                  resolveBarcode(e.target.value);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    resolveBarcode(barcodeInput);
                  }
                }}
                placeholder="Escanee código de barra o ingrese SKU..."
                className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border-2 border-slate-300 focus:border-[#263988] focus:bg-white rounded-lg text-sm font-mono text-slate-900 outline-none transition-all placeholder:text-slate-400 font-bold"
              />
              <div className="absolute right-3 top-3 text-slate-400">
                <Scan className="w-4 h-4" />
              </div>
            </div>

            <div className="text-[11px] text-slate-500 font-sans leading-tight">
              Aplica automáticamente <code className="text-slate-700 font-mono font-bold">LPAD(input, 6, '0')</code> para resolver códigos cortos de 6 dígitos y EAN-13 en menos de 5ms.
            </div>

            {/* Quick Test Barcode Buttons */}
            <div className="pt-2 border-t border-slate-100 space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-600 block">
                Códigos Rápidos para Demostración:
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleLoadSampleBarcode('7591001234567')}
                  className="px-2.5 py-1.5 text-left text-xs bg-slate-50 hover:bg-slate-100 rounded border border-slate-200 cursor-pointer"
                >
                  <div className="font-semibold text-slate-800 truncate">Amoxicilina 500mg</div>
                  <div className="text-[10px] text-slate-500 font-mono">EAN: 7591001234567</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleLoadSampleBarcode('7593009876543')}
                  className="px-2.5 py-1.5 text-left text-xs bg-amber-50 hover:bg-amber-100/80 rounded border border-amber-200 cursor-pointer"
                >
                  <div className="font-semibold text-amber-900 truncate">Probar Bloqueo (A)</div>
                  <div className="text-[10px] text-amber-700 font-mono">Completed / Match</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleLoadSampleBarcode('004521')}
                  className="px-2.5 py-1.5 text-left text-xs bg-blue-50 hover:bg-blue-100/80 rounded border border-blue-200 cursor-pointer"
                >
                  <div className="font-semibold text-blue-900 truncate">Probar Ficha (B)</div>
                  <div className="text-[10px] text-blue-700 font-mono">LPAD(4521, 6)</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleLoadSampleBarcode('7592004567891')}
                  className="px-2.5 py-1.5 text-left text-xs bg-slate-50 hover:bg-slate-100 rounded border border-slate-200 cursor-pointer"
                >
                  <div className="font-semibold text-slate-800 truncate">Ibuprofeno 400mg</div>
                  <div className="text-[10px] text-slate-500 font-mono">EAN: 7592004567891</div>
                </button>
              </div>
            </div>
          </div>

          {/* HTML5 Camera Viewport Simulation */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-3 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <Camera className="w-4 h-4 text-[#263988]" />
                <span>Viewport de Cámara HTML5 (BarcodeDetector)</span>
              </div>
              <button
                type="button"
                onClick={() => setIsCameraActive(!isCameraActive)}
                className={`text-[11px] font-semibold px-2 py-0.5 rounded cursor-pointer ${
                  isCameraActive ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {isCameraActive ? 'Detener Cámara' : 'Activar Cámara'}
              </button>
            </div>

            <div className="relative bg-slate-950 aspect-video flex items-center justify-center overflow-hidden">
              {isCameraActive ? (
                <>
                  <div className="absolute inset-0 bg-radial from-slate-900 via-slate-950 to-black opacity-90" />
                  
                  {/* Scanner Red Target Line & Reticle */}
                  <div className="relative w-64 h-36 border-2 border-emerald-400/80 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/10">
                    <div className="absolute inset-x-0 h-0.5 bg-rose-500 shadow-sm shadow-rose-500 animate-pulse" />
                    <span className="text-[10px] font-mono text-emerald-300 bg-black/60 px-2 py-0.5 rounded backdrop-blur-xs">
                      Enfocando Barcode...
                    </span>
                  </div>

                  {/* Flashlight toggle */}
                  <button
                    type="button"
                    onClick={() => setFlashlightOn(!flashlightOn)}
                    className="absolute bottom-3 right-3 p-2 bg-black/60 hover:bg-black/80 rounded-full text-white text-xs cursor-pointer"
                  >
                    <Zap className={`w-4 h-4 ${flashlightOn ? 'text-amber-400 fill-amber-400' : 'text-white'}`} />
                  </button>
                </>
              ) : (
                <div className="text-center p-6 space-y-2">
                  <Camera className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400">
                    Cámara desactivada. Utilice la lectura láser directa o active el visor móvil.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsCameraActive(true)}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-[#263988] hover:bg-[#1d2d6d] rounded-lg cursor-pointer"
                  >
                    Encender Cámara HTML5
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: V3 Conteo, Ecuación Transparente & Gamificación Live */}
        <div className="lg:col-span-7 space-y-4">
          {selectedSku ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-5">
              {/* Product Header & Financial PVP (IEEE 754) */}
              <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-[#263988] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      SKU: {selectedSku.sku_code}
                    </span>
                    <span className="text-xs text-slate-500 font-sans">
                      Cat: {selectedSku.category || 'General'}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 leading-snug">
                    {selectedSku.description}
                  </h3>
                </div>

                {/* IEEE 754 Financial Rounding PVP */}
                <div className="text-right shrink-0 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <div className="text-[10px] text-slate-500 uppercase font-sans font-semibold">
                    PVP con IVA ({impuestoPct}%)
                  </div>
                  <div className="text-base font-bold text-slate-900 font-mono tabular-nums">
                    ${pvp.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Base: ${precioBase.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Physical Count Input Controls */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Cantidad Contada Físicamente (C)
                  </label>
                  <span className="text-xs text-slate-500 font-mono">
                    Stock Teórico: {currentTask.system_quantity} unids
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setCountedQty(Math.max(0, countedQty - 1))}
                    className="w-11 h-11 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center font-bold text-slate-700 cursor-pointer transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>

                  <input
                    type="number"
                    min="0"
                    value={countedQty}
                    onChange={e => setCountedQty(Math.max(0, Number(e.target.value)))}
                    className="flex-1 h-11 text-center font-mono font-bold text-2xl text-slate-900 bg-slate-50 border-2 border-slate-300 focus:border-[#263988] rounded-lg outline-none"
                  />

                  <button
                    type="button"
                    onClick={() => setCountedQty(countedQty + 1)}
                    className="w-11 h-11 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center font-bold text-slate-700 cursor-pointer transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Quick Step Count Increments */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCountedQty(countedQty + 5)}
                    className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"
                  >
                    +5
                  </button>
                  <button
                    type="button"
                    onClick={() => setCountedQty(countedQty + 10)}
                    className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"
                  >
                    +10
                  </button>
                  <button
                    type="button"
                    onClick={() => setCountedQty(countedQty + 25)}
                    className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"
                  >
                    +25
                  </button>
                  <button
                    type="button"
                    onClick={() => setCountedQty(currentTask.system_quantity)}
                    className="px-2.5 py-1 text-xs font-semibold bg-blue-50 text-[#263988] border border-blue-200 hover:bg-blue-100 rounded cursor-pointer ml-auto"
                  >
                    = Teórico ({currentTask.system_quantity})
                  </button>
                </div>
              </div>

              {/* V3: Transparent Equation Display: ΔReal = C - (S - V) */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                    <Calculator className="w-4 h-4 text-[#263988]" />
                    <span>Ecuación Transparente de Auditoría:</span>
                  </span>
                  <span className="font-mono font-bold text-slate-700">
                    ΔReal = C - (S - V)
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center font-mono">
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <div className="text-[10px] text-slate-500 uppercase font-sans">Físico (C)</div>
                    <div className="text-base font-bold text-slate-900">{countedQty}</div>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <div className="text-[10px] text-slate-500 uppercase font-sans">Teórico (S)</div>
                    <div className="text-base font-bold text-slate-900">{currentTask.system_quantity}</div>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <div className="text-[10px] text-slate-500 uppercase font-sans">Ventas (V)</div>
                    <div className="text-base font-bold text-slate-900">{currentTask.sales_during_audit}</div>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <div className="text-[10px] text-slate-500 uppercase font-sans">Neto (S - V)</div>
                    <div className="text-base font-bold text-slate-900">{effectiveTheoretical}</div>
                  </div>
                </div>

                {/* Banner Verde Esmeralda (#009045) si ΔReal = 0 // Banner Ámbar/Rojo si ΔReal ≠ 0 */}
                {isMatch ? (
                  <div className="p-3 bg-[#009045] text-white rounded-lg flex items-center justify-between shadow-xs">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-white" />
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider">
                          Reconciled Match (ΔReal = 0)
                        </div>
                        <div className="text-[11px] text-emerald-100">
                          El conteo físico coincide exactamente con el inventario neto.
                        </div>
                      </div>
                    </div>
                    <span className="text-sm font-mono font-bold bg-white/20 px-2 py-1 rounded">
                      +50 XP Bonus
                    </span>
                  </div>
                ) : (
                  <div className={`p-3 rounded-lg flex items-center justify-between shadow-xs ${
                    deltaReal > 0 
                      ? 'bg-amber-500 text-slate-950' 
                      : 'bg-rose-600 text-white'
                  }`}>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 fill-current" />
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider">
                          {deltaReal > 0 ? `Sobrante Detectado (+${deltaReal} unids)` : `Faltante Detectado (${deltaReal} unids)`}
                        </div>
                        <div className={`text-[11px] ${deltaReal > 0 ? 'text-amber-950' : 'text-rose-100'}`}>
                          Se notificará para compensación virtual hacia el Nodo 150104.
                        </div>
                      </div>
                    </div>
                    <span className="text-sm font-mono font-bold bg-black/15 px-2 py-1 rounded">
                      Δ = {deltaReal > 0 ? `+${deltaReal}` : deltaReal}
                    </span>
                  </div>
                )}
              </div>

              {/* V3: Gamificación Live: Cálculo de XP con Multiplicador y Bonos */}
              <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#263988] flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-500 fill-amber-500" />
                    <span>XP Live Estimado para este Conteo:</span>
                  </span>
                  <span className="font-mono font-bold text-emerald-700 text-sm">
                    +{xpMetrics.totalXP} XP
                  </span>
                </div>

                <div className="text-[11px] text-slate-600 font-mono flex flex-wrap items-center gap-2">
                  <span>Base: {xpMetrics.baseXP} ({countedQty} × 10 × {activeDeposit.multiplier.toFixed(1)}x)</span>
                  {xpMetrics.streakBonus > 0 && (
                    <span className="text-amber-700 font-bold bg-amber-100/70 px-1.5 py-0.5 rounded">
                      +{xpMetrics.streakBonus} Racha ({currentStreak} consec.)
                    </span>
                  )}
                  {xpMetrics.verificationBonus > 0 && (
                    <span className="text-emerald-700 font-bold bg-emerald-100/70 px-1.5 py-0.5 rounded">
                      +{xpMetrics.verificationBonus} Match Exacto
                    </span>
                  )}
                </div>
              </div>

              {/* Primary Action Button (CTA Verde #009045) */}
              <button
                type="button"
                onClick={handleSubmitCount}
                className="w-full py-3 text-sm font-bold text-white bg-[#009045] hover:bg-[#007b3b] rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>Confirmar y Guardar Conteo (+{xpMetrics.totalXP} XP)</span>
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-12 text-center space-y-3">
              <Scan className="w-12 h-12 text-slate-300 mx-auto" />
              <h4 className="text-base font-bold text-slate-800">
                Esperando Lectura de Producto
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Escanee un código de barras físico con el lector láser o seleccione uno de los accesos directos para visualizar la ecuación en vivo.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL A (OBLIGATORIO): Bloqueo Re-conteo (Overlay Ámbar #F59E0B)           */}
      {/* ========================================================================= */}
      {showModalABlocked && blockedTaskInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border-4 border-[#F59E0B] max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#F59E0B]/20 border border-[#F59E0B]/50 flex items-center justify-center text-[#F59E0B] shrink-0">
                <Lock className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 leading-tight">
                  Ítem Bloqueado por Re-conteo
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Estado: Completed / Reconciled_Match
                </p>
              </div>
            </div>

            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200/80 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-amber-900 font-medium">Producto:</span>
                <span className="font-bold text-slate-900">{blockedTaskInfo.skuName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-900 font-medium">Código SKU:</span>
                <span className="font-mono font-bold text-slate-900">{blockedTaskInfo.skuCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-900 font-medium">Auditor Responsable:</span>
                <span className="font-bold text-slate-900">{blockedTaskInfo.auditorName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-900 font-medium">Hora de Cierre:</span>
                <span className="font-mono text-slate-900">{blockedTaskInfo.closedAt}</span>
              </div>
              <div className="flex justify-between border-t border-amber-200 pt-1 font-semibold">
                <span className="text-amber-900">Cantidad Registrada:</span>
                <span className="text-emerald-700 font-bold">{blockedTaskInfo.countedQty} unidades</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-sans">
              La tupla <strong>(Misión + Depósito + SKU)</strong> ya ha sido auditada y cerrada formalmente. Para evitar duplicidades o adulteración de datos, este registro está <strong>bloqueado contra modificaciones</strong>.
            </p>

            <button
              type="button"
              onClick={() => {
                setShowModalABlocked(false);
                setBarcodeInput('');
                setSelectedSku(null);
                barcodeInputRef.current?.focus();
              }}
              className="w-full py-2.5 text-xs font-bold text-slate-950 bg-[#F59E0B] hover:bg-amber-400 rounded-xl transition-colors cursor-pointer shadow-xs"
            >
              Entendido / Cerrar Alerta
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL B (OBLIGATORIO): Ficha Incompleta (Formulario Obligatorio)           */}
      {/* ========================================================================= */}
      {showModalBFichaIncompleta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#263988] shrink-0">
                <FileEdit className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Ficha Técnica Incompleta
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  SKU: {selectedSku?.sku_code} (IsFichaComplete = false)
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Este producto no posee descripción o categoría en el catálogo maestro. Complete los datos obligatorios antes de registrar el conteo físico:
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-700 font-bold block mb-1">
                  Descripción Comercial *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Vitamina D3 2000 UI x 30 Tabletas"
                  value={fichaForm.description}
                  onChange={e => setFichaForm({ ...fichaForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium outline-none focus:border-[#263988]"
                />
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">
                  Categoría Farmacéutica *
                </label>
                <select
                  value={fichaForm.category}
                  onChange={e => setFichaForm({ ...fichaForm, category: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium outline-none focus:border-[#263988]"
                >
                  <option value="Antibióticos">Antibióticos</option>
                  <option value="Analgésicos">Analgésicos y Antiinflamatorios</option>
                  <option value="Vitaminas">Vitaminas y Suplementos</option>
                  <option value="Gastroenterología">Gastroenterología</option>
                  <option value="Cardiología">Cardiología y Presión</option>
                  <option value="Material Médico">Material Médico Descartable</option>
                  <option value="Cuidado Personal">Cuidado Personal</option>
                </select>
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">
                  Presentación / Envase
                </label>
                <input
                  type="text"
                  placeholder="Ej: Frasco x 60 Cápsulas"
                  value={fichaForm.presentation}
                  onChange={e => setFichaForm({ ...fichaForm, presentation: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 outline-none focus:border-[#263988]"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowModalBFichaIncompleta(false);
                  setBarcodeInput('');
                  setSelectedSku(null);
                  barcodeInputRef.current?.focus();
                }}
                className="flex-1 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={!fichaForm.description.trim()}
                onClick={handleSaveModalBFicha}
                className="flex-1 py-2 text-xs font-bold text-white bg-[#009045] hover:bg-[#007b3b] disabled:opacity-50 rounded-lg cursor-pointer shadow-xs"
              >
                Guardar Ficha y Continuar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
