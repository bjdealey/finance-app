'use server';

import { parse } from 'csv-parse/sync';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/server/auth/session';
import { detectColumns, normalizeRow, type ColumnMap, type ParsedRow } from '@/core/import';
import { importTransactions } from '@/server/services/import';

export interface PreviewData {
  headers: string[];
  sample: Record<string, string>[];
  mapping: ColumnMap;
  rowCount: number;
  error?: string;
}

function parseCsv(text: string): Record<string, string>[] {
  return parse(text, { columns: true, skip_empty_lines: true, trim: true, bom: true, relax_column_count: true });
}

export async function previewImport(_prev: PreviewData | null, formData: FormData): Promise<PreviewData> {
  await requireUser();
  const empty = { headers: [], sample: [], mapping: {}, rowCount: 0 };
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { ...empty, error: 'Choose a CSV file to preview.' };
  let records: Record<string, string>[];
  try {
    records = parseCsv(await file.text());
  } catch {
    return { ...empty, error: 'Could not parse that file as CSV.' };
  }
  const headers = records.length ? Object.keys(records[0]) : [];
  if (!headers.length) return { ...empty, error: 'No rows found in the CSV.' };
  return { headers, sample: records.slice(0, 8), mapping: detectColumns(headers), rowCount: records.length };
}

export interface ImportActionResult {
  imported?: number;
  duplicates?: number;
  errors?: number;
  transfersDetected?: number;
  error?: string;
  done?: boolean;
}

export async function runImport(_prev: ImportActionResult | null, formData: FormData): Promise<ImportActionResult> {
  const user = await requireUser();
  const file = formData.get('file');
  const accountId = String(formData.get('accountId') ?? '');
  let mapping: ColumnMap;
  try {
    mapping = JSON.parse(String(formData.get('mapping') ?? '{}'));
  } catch {
    return { error: 'Invalid column mapping.' };
  }
  if (!(file instanceof File) || file.size === 0) return { error: 'No file provided.' };
  if (!accountId) return { error: 'Choose which account to import into.' };
  if (!mapping.date || (!mapping.amount && !mapping.debit && !mapping.credit)) {
    return { error: 'Map at least a date column and an amount (or debit/credit) column.' };
  }

  let records: Record<string, string>[];
  try {
    records = parseCsv(await file.text());
  } catch {
    return { error: 'Could not parse that file as CSV.' };
  }

  const rows: ParsedRow[] = [];
  let errors = 0;
  for (const rec of records) {
    const res = normalizeRow(rec, mapping);
    if (res.ok) rows.push(res.row);
    else errors++;
  }

  const result = await importTransactions(user.id, accountId, rows, file.name);
  revalidatePath('/transactions');
  revalidatePath('/dashboard');
  return { imported: result.imported, duplicates: result.duplicates, transfersDetected: result.transfersDetected, errors, done: true };
}
