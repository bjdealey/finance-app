'use client';

import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import { previewImport, runImport, type PreviewData, type ImportActionResult } from '@/app/(app)/transactions/import/actions';
import type { ColumnMap } from '@/core/import';
import type { AccountRef } from '@/server/services/reference';
import { Card } from '@/components/ui';

const FIELDS: { key: keyof ColumnMap; label: string }[] = [
  { key: 'date', label: 'Date' },
  { key: 'description', label: 'Description' },
  { key: 'amount', label: 'Amount (signed)' },
  { key: 'debit', label: 'Debit / out' },
  { key: 'credit', label: 'Credit / in' },
  { key: 'balance', label: 'Balance' },
];

export function ImportWizard({ accounts }: { accounts: AccountRef[] }) {
  const [file, setFile] = useState<File | null>(null);
  const [accountId, setAccountId] = useState('');
  const [mapping, setMapping] = useState<ColumnMap>({});
  const [preview, previewAction, previewing] = useActionState<PreviewData | null, FormData>(previewImport, null);
  const [result, importAction, importing] = useActionState<ImportActionResult | null, FormData>(runImport, null);

  useEffect(() => {
    if (preview && !preview.error) setMapping(preview.mapping);
  }, [preview]);

  const doPreview = () => {
    if (!file) return;
    const fd = new FormData();
    fd.set('file', file);
    previewAction(fd);
  };
  const doImport = () => {
    if (!file || !accountId) return;
    const fd = new FormData();
    fd.set('file', file);
    fd.set('accountId', accountId);
    fd.set('mapping', JSON.stringify(mapping));
    importAction(fd);
  };

  if (result?.done) return <ResultView result={result} />;

  const ready = preview && !preview.error;

  return (
    <div className="space-y-6">
      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">CSV file</span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Import into account</span>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="">Choose account…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4">
          <button
            onClick={doPreview}
            disabled={!file || previewing}
            className="rounded-lg bg-fg px-4 py-2 text-sm font-medium text-bg disabled:opacity-50"
          >
            {previewing ? 'Reading…' : 'Preview'}
          </button>
          {preview?.error && <span className="ml-3 text-sm text-neg">{preview.error}</span>}
        </div>
      </Card>

      {ready && (
        <Card>
          <div className="mb-3 text-sm text-muted">
            Detected <strong className="text-fg">{preview.rowCount.toLocaleString()}</strong> rows. Confirm the column mapping:
          </div>
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3">
            {FIELDS.map((f) => (
              <label key={f.key} className="block text-sm">
                <span className="mb-1 block text-xs text-muted">{f.label}</span>
                <select
                  value={mapping[f.key] ?? ''}
                  onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value || undefined }))}
                  className="w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-primary"
                >
                  <option value="">— none —</option>
                  {preview.headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="bg-surface-2 text-left text-muted">
                <tr>{preview.headers.map((h) => <th key={h} className="px-2 py-1.5 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-border">
                {preview.sample.map((row, i) => (
                  <tr key={i}>{preview.headers.map((h) => <td key={h} className="px-2 py-1.5 tnum">{row[h]}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={doImport}
              disabled={!accountId || importing}
              className="rounded-lg bg-primary-strong px-4 py-2 text-sm font-medium text-primary-fg disabled:opacity-50"
            >
              {importing ? 'Importing…' : `Import ${preview.rowCount.toLocaleString()} rows`}
            </button>
            {!accountId && <span className="text-sm text-warn">Choose an account first.</span>}
            {result?.error && <span className="text-sm text-neg">{result.error}</span>}
          </div>
        </Card>
      )}
    </div>
  );
}

function ResultView({ result }: { result: ImportActionResult }) {
  return (
    <Card>
      <h2 className="text-lg font-semibold">Import complete</h2>
      <ul className="mt-3 space-y-1 text-sm">
        <li>Imported: <strong>{result.imported ?? 0}</strong></li>
        <li>Skipped (already in your data): <strong>{result.duplicates ?? 0}</strong></li>
        {(result.possibleDuplicates ?? 0) > 0 && (
          <li>Possible duplicates within the file (imported — please review): <strong>{result.possibleDuplicates}</strong></li>
        )}
        <li>Rows with errors: <strong>{result.errors ?? 0}</strong></li>
        <li>Internal transfers detected &amp; excluded from spending: <strong>{result.transfersDetected ?? 0}</strong></li>
      </ul>
      <Link href="/transactions" className="mt-5 inline-block rounded-lg bg-primary-strong px-4 py-2 text-sm font-medium text-primary-fg">
        View transactions
      </Link>
    </Card>
  );
}
