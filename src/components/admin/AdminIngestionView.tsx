/**
 * M1: Ingesta Estática con Merge Engine y Hash SHA-256 (/admin/ingesta)
 * AUDITORIAPLUS+ Superuser Desktop Cockpit (1920x1080)
 * 
 * Logic & Workflow:
 * - Drag & Drop para Excel A (Taxonomía) y Excel B (Costo).
 * - Procesamiento en cliente con librería SheetJS (xlsx).
 * - Cálculo SHA-256 local con window.crypto.subtle.digest('SHA-256', arrayBuffer).
 * - Validación contra Read_Missions.IngestionLogs: Si existe, detiene con alerta:
 *   'Error: Este archivo ya fue procesado previamente'.
 * - Merge Engine: combina taxonomía de A con costo de B, aplica LPAD(sku, 6, '0')
 *   y fija IsFichaComplete = true.
 */

import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useAuditStore, IngestionLogRecord } from '../../store/useAuditStore';
import { 
  calculateSHA256, 
  lpadSku, 
  generateSampleTaxonomyWorkbook, 
  generateSampleCostWorkbook,
  MergedSkuRecord
} from '../../utils/cryptoUtils';
import { upsertSkuMaster } from '../../services/offlineDatabase';
import { 
  UploadCloud, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  Download, 
  FileText, 
  Layers, 
  Sparkles, 
  ArrowRight,
  Database,
  Hash,
  X,
  Play
} from 'lucide-react';

interface ParsedFile {
  file: File;
  name: string;
  size: number;
  hash: string;
  rows: any[];
  headers: string[];
}

export const AdminIngestionView: React.FC = () => {
  const { ingestionLogs, addIngestionLog } = useAuditStore();

  const [fileA, setFileA] = useState<ParsedFile | null>(null);
  const [fileB, setFileB] = useState<ParsedFile | null>(null);

  const [isProcessingA, setIsProcessingA] = useState(false);
  const [isProcessingB, setIsProcessingB] = useState(false);
  const [isMerging, setIsMerging] = useState(false);

  // Exact Error Alert Required
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Merged output state
  const [mergedResults, setMergedResults] = useState<MergedSkuRecord[]>([]);

  const inputRefA = useRef<HTMLInputElement>(null);
  const inputRefB = useRef<HTMLInputElement>(null);

  // Check if hash exists in Read_Missions.IngestionLogs
  const isHashPreviouslyProcessed = (hash: string): boolean => {
    return ingestionLogs.some(log => log.hash.toLowerCase() === hash.toLowerCase());
  };

  // Process Excel file using xlsx & window.crypto.subtle
  const processExcelFile = async (
    file: File, 
    type: 'Taxonomy' | 'Cost'
  ): Promise<ParsedFile | null> => {
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const arrayBuffer = await file.arrayBuffer();

      // 1. Calculate SHA-256 hash locally in browser
      const hash = await calculateSHA256(arrayBuffer);

      // 2. Exact Check: Si el hash existe en Read_Missions.IngestionLogs, detiene la subida
      if (isHashPreviouslyProcessed(hash)) {
        const errorText = 'Error: Este archivo ya fue procesado previamente';
        setErrorMessage(errorText);
        window.alert(errorText);
        return null;
      }

      // 3. Parse with xlsx (SheetJS)
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      const headers = rows.length > 0 ? Object.keys(rows[0]) : [];

      return {
        file,
        name: file.name,
        size: file.size,
        hash,
        rows,
        headers,
      };
    } catch (err: any) {
      setErrorMessage(`Error al procesar el archivo Excel: ${err?.message || 'Formato no soportado'}`);
      return null;
    }
  };

  // Handlers for File A (Taxonomía)
  const handleFileASelected = async (file: File) => {
    setIsProcessingA(true);
    const parsed = await processExcelFile(file, 'Taxonomy');
    if (parsed) {
      setFileA(parsed);
      setSuccessMessage(`Excel A (Taxonomía) verificado con hash SHA-256: ${parsed.hash.substring(0, 16)}...`);
    }
    setIsProcessingA(false);
  };

  // Handlers for File B (Costo)
  const handleFileBSelected = async (file: File) => {
    setIsProcessingB(true);
    const parsed = await processExcelFile(file, 'Cost');
    if (parsed) {
      setFileB(parsed);
      setSuccessMessage(`Excel B (Costo) verificado con hash SHA-256: ${parsed.hash.substring(0, 16)}...`);
    }
    setIsProcessingB(false);
  };

  // Execute Merge Engine
  const handleRunMergeEngine = async () => {
    if (!fileA || !fileB) {
      setErrorMessage('Debes cargar ambos archivos (Excel A y Excel B) para ejecutar el Merge Engine');
      return;
    }

    setIsMerging(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      // Index File B (Costos) by normalized LPAD SKU
      const costMap = new Map<string, any>();
      for (const row of fileB.rows) {
        const rawSku = row.sku || row.SKU || row.codigo || row.Codigo;
        if (rawSku !== undefined && rawSku !== '') {
          const lpadCode = lpadSku(rawSku, 6);
          costMap.set(lpadCode, row);
        }
      }

      // Merge File A (Taxonomía) with File B (Costos)
      const merged: MergedSkuRecord[] = [];

      for (const rowA of fileA.rows) {
        const rawSku = rowA.sku || rowA.SKU || rowA.codigo || rowA.Codigo;
        if (rawSku === undefined || rawSku === '') continue;

        const normalizedSku = lpadSku(rawSku, 6);
        const costData = costMap.get(normalizedSku) || {};

        const barcode = String(rowA.codigo_barra || rowA.barcode || rowA.Barcode || normalizedSku);
        const description = String(rowA.descripcion || rowA.Descripcion || rowA.nombre || `Producto ${normalizedSku}`);
        const category = String(rowA.categoria || rowA.Categoria || 'Farmacia General');
        const presentation = String(rowA.presentacion || rowA.Presentacion || 'Unidad');

        const precioBase = Number(costData.precio_base || costData.precio || costData.PrecioBase || 5.0);
        const costoPromedio = Number(costData.costo_promedio || costData.costo || costData.Costo || 3.0);
        const taxRate = Number(costData.impuesto_pct || costData.iva || 16.0);

        const record: MergedSkuRecord = {
          sku_code: normalizedSku,
          barcode,
          description,
          category,
          presentation,
          precio_base: precioBase,
          costo_promedio: costoPromedio,
          tax_rate: taxRate,
          is_active: true,
          IsFichaComplete: true, // Requerimiento explícito: fija IsFichaComplete = true
          merged_at: new Date().toISOString(),
          source_tax_file: fileA.name,
          source_cost_file: fileB.name,
        };

        merged.push(record);

        // Guardar en la base IndexedDB sku_master_local para que el Auditor lo resuelva en <5ms
        await upsertSkuMaster({
          sku_code: record.sku_code,
          barcode: record.barcode,
          description: record.description,
          category: record.category,
          presentation: record.presentation,
          tax_rate: record.tax_rate,
          is_active: true,
        });
      }

      setMergedResults(merged);

      // Registrar hashes en Read_Missions.IngestionLogs para evitar reutilización
      addIngestionLog({
        id: `ingest-${Date.now()}-A`,
        hash: fileA.hash,
        fileName: fileA.name,
        type: 'Taxonomy',
        rowCount: fileA.rows.length,
        processedAt: new Date().toISOString(),
        status: 'Success',
      });

      addIngestionLog({
        id: `ingest-${Date.now()}-B`,
        hash: fileB.hash,
        fileName: fileB.name,
        type: 'Cost',
        rowCount: fileB.rows.length,
        processedAt: new Date().toISOString(),
        status: 'Success',
      });

      setSuccessMessage(
        `Merge Engine exitoso: ${merged.length} productos combinados, formateados con LPAD(sku, 6, '0') e IsFichaComplete = true. Datos indexados en sku_master_local.`
      );
    } catch (err: any) {
      setErrorMessage(`Fallo en el Merge Engine: ${err?.message || 'Error en combinación'}`);
    } finally {
      setIsMerging(false);
    }
  };

  // Download Sample Template Helpers
  const downloadSampleA = () => {
    const data = generateSampleTaxonomyWorkbook();
    const blob = new Blob([data.buffer as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Plantilla_Excel_A_Taxonomia.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadSampleB = () => {
    const data = generateSampleCostWorkbook();
    const blob = new Blob([data.buffer as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Plantilla_Excel_B_Costo.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Quick 1-Click Load Sample Demo
  const handleLoadDemoFiles = async () => {
    const dataA = generateSampleTaxonomyWorkbook();
    const blobA = new Blob([dataA.buffer as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileAObj = new File([blobA], 'Taxonomia_MaraPlus_2026.xlsx', { type: blobA.type });

    const dataB = generateSampleCostWorkbook();
    const blobB = new Blob([dataB.buffer as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileBObj = new File([blobB], 'Costos_ERP_2026.xlsx', { type: blobB.type });

    await handleFileASelected(fileAObj);
    await handleFileBSelected(fileBObj);
  };

  return (
    <div className="space-y-6">
      {/* Route & Sub-header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded">
              M1: INGESTA ESTÁTICA
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-xs font-mono text-slate-400">/admin/ingesta</span>
            <span className="text-slate-600">·</span>
            <span className="text-xs text-slate-400">SheetJS (xlsx) + Web Crypto SHA-256</span>
          </div>
          <h2 className="text-xl font-bold text-white mt-1">
            Merge Engine de Taxonomía y Costos con Deduplicación Criptográfica
          </h2>
          <p className="text-xs text-slate-400">
            Carga de archivos Excel con validación de Hash SHA-256 contra <code>Read_Missions.IngestionLogs</code>, normalización <code>LPAD(sku, 6, '0')</code> y fijación obligatoria de <code>IsFichaComplete = true</code>.
          </p>
        </div>

        {/* Action Tools */}
        <div className="flex flex-wrap items-center gap-2 self-start xl:self-auto">
          <button
            onClick={downloadSampleA}
            className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-900 border border-slate-700 hover:bg-slate-800 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Plantilla Excel A (Taxonomía)</span>
          </button>

          <button
            onClick={downloadSampleB}
            className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-900 border border-slate-700 hover:bg-slate-800 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span>Plantilla Excel B (Costo)</span>
          </button>

          <button
            onClick={handleLoadDemoFiles}
            className="px-3 py-1.5 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Cargar Archivos de Prueba</span>
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 flex items-start justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <div className="font-bold text-sm text-white">Alerta de Seguridad e Integridad</div>
              <div className="text-xs font-mono mt-0.5">{errorMessage}</div>
            </div>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-200 flex items-start justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <div className="font-bold text-sm text-white">Operación Exitosa</div>
              <div className="text-xs font-mono mt-0.5">{successMessage}</div>
            </div>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Dual Drag & Drop Ingestion Zones */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Drop Zone A: Excel A (Taxonomía) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-xs">
                  A
                </div>
                <h3 className="text-sm font-bold text-white">Excel A: Taxonomía y Catálogo</h3>
              </div>
              <span className="text-[11px] font-mono text-slate-400">Columnas: sku, descripcion, categoria</span>
            </div>

            {/* Drag & Drop Area */}
            <div
              onClick={() => inputRefA.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFileASelected(e.dataTransfer.files[0]);
                }
              }}
              className={`mt-4 border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                fileA
                  ? 'border-emerald-500/40 bg-emerald-950/20'
                  : 'border-slate-700 hover:border-emerald-500/40 bg-slate-950/60 hover:bg-slate-950'
              }`}
            >
              <input
                ref={inputRefA}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={(e) => e.target.files?.[0] && handleFileASelected(e.target.files[0])}
                className="hidden"
              />

              {fileA ? (
                <div className="space-y-2">
                  <FileSpreadsheet className="w-8 h-8 text-emerald-400 mx-auto" />
                  <div className="font-bold text-sm text-white">{fileA.name}</div>
                  <div className="text-xs font-mono text-slate-400">
                    {(fileA.size / 1024).toFixed(1)} KB · {fileA.rows.length} filas leídas
                  </div>
                  <div className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 py-1 px-2 rounded break-all border border-emerald-800/40">
                    SHA-256: {fileA.hash}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <UploadCloud className="w-8 h-8 text-slate-500 mx-auto" />
                  <div className="text-sm font-medium text-slate-200">
                    Arrastra aquí el archivo <strong className="text-emerald-400">Excel A (Taxonomía)</strong>
                  </div>
                  <p className="text-xs text-slate-500">o haz clic para explorar en tu equipo</p>
                </div>
              )}
            </div>
          </div>

          {fileA && (
            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">Campos detectados:</span>
              <span className="font-mono text-slate-300">{fileA.headers.slice(0, 4).join(', ')}...</span>
            </div>
          )}
        </div>

        {/* Drop Zone B: Excel B (Costo) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-xs">
                  B
                </div>
                <h3 className="text-sm font-bold text-white">Excel B: Maestro de Costos y Precios</h3>
              </div>
              <span className="text-[11px] font-mono text-slate-400">Columnas: sku, precio_base, costo_promedio</span>
            </div>

            {/* Drag & Drop Area */}
            <div
              onClick={() => inputRefB.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFileBSelected(e.dataTransfer.files[0]);
                }
              }}
              className={`mt-4 border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                fileB
                  ? 'border-blue-500/40 bg-blue-950/20'
                  : 'border-slate-700 hover:border-blue-500/40 bg-slate-950/60 hover:bg-slate-950'
              }`}
            >
              <input
                ref={inputRefB}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={(e) => e.target.files?.[0] && handleFileBSelected(e.target.files[0])}
                className="hidden"
              />

              {fileB ? (
                <div className="space-y-2">
                  <FileSpreadsheet className="w-8 h-8 text-blue-400 mx-auto" />
                  <div className="font-bold text-sm text-white">{fileB.name}</div>
                  <div className="text-xs font-mono text-slate-400">
                    {(fileB.size / 1024).toFixed(1)} KB · {fileB.rows.length} filas leídas
                  </div>
                  <div className="text-[11px] font-mono text-blue-400 bg-blue-950/60 py-1 px-2 rounded break-all border border-blue-800/40">
                    SHA-256: {fileB.hash}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <UploadCloud className="w-8 h-8 text-slate-500 mx-auto" />
                  <div className="text-sm font-medium text-slate-200">
                    Arrastra aquí el archivo <strong className="text-blue-400">Excel B (Costo)</strong>
                  </div>
                  <p className="text-xs text-slate-500">o haz clic para explorar en tu equipo</p>
                </div>
              )}
            </div>
          </div>

          {fileB && (
            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">Campos detectados:</span>
              <span className="font-mono text-slate-300">{fileB.headers.slice(0, 4).join(', ')}...</span>
            </div>
          )}
        </div>
      </div>

      {/* Central Merge Engine Control Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <h4 className="text-sm font-bold text-white">Merge Engine & Normalización de Ficha</h4>
          </div>
          <p className="text-xs text-slate-400">
            Cruza registros por SKU mediante <code className="text-emerald-300 font-mono">LPAD(sku, 6, '0')</code>, inyecta precios base y establece <code className="text-emerald-300 font-mono">IsFichaComplete = true</code>.
          </p>
        </div>

        <button
          onClick={handleRunMergeEngine}
          disabled={!fileA || !fileB || isMerging}
          className="px-5 py-2.5 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl flex items-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-md self-start sm:self-auto"
        >
          {isMerging ? (
            <>
              <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              <span>Procesando Merge...</span>
            </>
          ) : (
            <>
              <Layers className="w-4 h-4" />
              <span>Ejecutar Merge Engine</span>
            </>
          )}
        </button>
      </div>

      {/* Merged Results Table Preview */}
      {mergedResults.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-md">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" />
              <h4 className="text-sm font-bold text-white">
                Resultado de Fichas Completas Normalizadas ({mergedResults.length} ítems)
              </h4>
            </div>
            <span className="text-xs font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
              IsFichaComplete = true
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] border-b border-slate-800">
                <tr>
                  <th className="px-4 py-2.5">SKU (LPAD 6)</th>
                  <th className="px-4 py-2.5">Código Barras</th>
                  <th className="px-4 py-2.5">Descripción</th>
                  <th className="px-4 py-2.5">Categoría</th>
                  <th className="px-4 py-2.5">Precio Base</th>
                  <th className="px-4 py-2.5">Costo Promedio</th>
                  <th className="px-4 py-2.5">Estado Ficha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {mergedResults.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40">
                    <td className="px-4 py-2 text-emerald-300 font-bold">{item.sku_code}</td>
                    <td className="px-4 py-2 text-slate-300">{item.barcode}</td>
                    <td className="px-4 py-2 text-white font-sans">{item.description}</td>
                    <td className="px-4 py-2 text-slate-400">{item.category}</td>
                    <td className="px-4 py-2 text-slate-200">${item.precio_base.toFixed(2)}</td>
                    <td className="px-4 py-2 text-slate-400">${item.costo_promedio.toFixed(2)}</td>
                    <td className="px-4 py-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1 w-fit">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>Completa</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Ingestion Logs Table (Audit Trail) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Hash className="w-4 h-4 text-slate-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Read_Missions.IngestionLogs (Historial de Deduplicación Criptográfica)
            </h4>
          </div>
          <span className="text-[11px] font-mono text-slate-500">Hash SHA-256 inmutable</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] border-b border-slate-800">
              <tr>
                <th className="px-4 py-2.5">Archivo</th>
                <th className="px-4 py-2.5">Tipo</th>
                <th className="px-4 py-2.5">Filas</th>
                <th className="px-4 py-2.5">SHA-256 Hash</th>
                <th className="px-4 py-2.5">Fecha UTC</th>
                <th className="px-4 py-2.5">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {ingestionLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/30">
                  <td className="px-4 py-2.5 text-white font-sans">{log.fileName}</td>
                  <td className="px-4 py-2.5 text-slate-300">{log.type}</td>
                  <td className="px-4 py-2.5 text-slate-400">{log.rowCount}</td>
                  <td className="px-4 py-2.5 text-slate-400 truncate max-w-xs">{log.hash}</td>
                  <td className="px-4 py-2.5 text-slate-500">{new Date(log.processedAt).toLocaleString()}</td>
                  <td className="px-4 py-2.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                      {log.status}
                    </span>
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
