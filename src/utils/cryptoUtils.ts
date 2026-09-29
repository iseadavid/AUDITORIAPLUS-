/**
 * AUDITORIAPLUS+ Ingestion & Cryptographic Utilities
 * - Client-side SHA-256 calculation via Web Crypto API (window.crypto.subtle)
 * - LPAD string formatting
 * - Sample Excel generator using xlsx (SheetJS) for instant drag & drop testing
 */

import * as XLSX from 'xlsx';

/**
 * Calculates SHA-256 hash of an ArrayBuffer in hex format
 */
export async function calculateSHA256(buffer: ArrayBuffer): Promise<string> {
  if (!window.crypto || !window.crypto.subtle) {
    throw new Error('Web Crypto API no disponible en este entorno');
  }
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * LPAD implementation to guarantee 6-digit SKUs format
 */
export function lpadSku(sku: string | number, length: number = 6): string {
  const str = String(sku || '').trim();
  if (str.length >= length) return str;
  return str.padStart(length, '0');
}

export interface ExcelTaxonomyRow {
  sku: string | number;
  codigo_barra?: string;
  descripcion: string;
  categoria: string;
  presentacion?: string;
}

export interface ExcelCostRow {
  sku: string | number;
  precio_base: number;
  costo_promedio: number;
  impuesto_pct?: number;
}

export interface MergedSkuRecord {
  sku_code: string;
  barcode: string;
  description: string;
  category: string;
  presentation: string;
  precio_base: number;
  costo_promedio: number;
  tax_rate: number;
  is_active: boolean;
  IsFichaComplete: boolean;
  merged_at: string;
  source_tax_file: string;
  source_cost_file: string;
}

/**
 * Generates sample Excel binary for Excel A (Taxonomía)
 */
export function generateSampleTaxonomyWorkbook(): Uint8Array {
  const sampleData: ExcelTaxonomyRow[] = [
    { sku: '101', codigo_barra: '7591001234567', descripcion: 'Amoxicilina 500mg', categoria: 'Antibióticos', presentacion: 'Caja x 10 Cápsulas' },
    { sku: '102', codigo_barra: '7592004567891', descripcion: 'Ibuprofeno 400mg', categoria: 'Analgésicos', presentacion: 'Blister x 20 Tabletas' },
    { sku: '103', codigo_barra: '7593009876543', descripcion: 'Paracetamol 650mg', categoria: 'Analgésicos', presentacion: 'Caja x 10 Tabletas' },
    { sku: '104', codigo_barra: '7594002345678', descripcion: 'Loratadina 10mg', categoria: 'Antialérgicos', presentacion: 'Caja x 10 Tabletas' },
    { sku: '105', codigo_barra: '7595008765432', descripcion: 'Omeprazol 20mg', categoria: 'Gastroenterología', presentacion: 'Frasco x 14 Cápsulas' },
    { sku: '4521', codigo_barra: '7596001122334', descripcion: 'Vitamina C 1000mg', categoria: 'Suplementos', presentacion: 'Tubo x 10 Efervescentes' },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Taxonomia');
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
}

/**
 * Generates sample Excel binary for Excel B (Costo)
 */
export function generateSampleCostWorkbook(): Uint8Array {
  const sampleData: ExcelCostRow[] = [
    { sku: '101', precio_base: 8.50, costo_promedio: 5.20, impuesto_pct: 16.0 },
    { sku: '102', precio_base: 4.20, costo_promedio: 2.80, impuesto_pct: 16.0 },
    { sku: '103', precio_base: 3.80, costo_promedio: 2.10, impuesto_pct: 16.0 },
    { sku: '104', precio_base: 4.85, costo_promedio: 3.10, impuesto_pct: 16.0 },
    { sku: '105', precio_base: 7.20, costo_promedio: 4.50, impuesto_pct: 16.0 },
    { sku: '4521', precio_base: 6.50, costo_promedio: 3.90, impuesto_pct: 16.0 },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Costos');
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
}
