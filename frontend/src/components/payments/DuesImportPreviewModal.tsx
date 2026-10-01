import { type ChangeEvent, useState } from 'react';
import axios from 'axios';
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  LoaderCircle,
  UploadCloud,
  X,
} from 'lucide-react';
import { API_BASE_URL } from '../../config/api';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface DuesRecord {
  source_row: number;
  block: string;
  lot: string;
  first_name: string;
  last_name: string;
  total: string;
  months: Record<string, string>;
}

interface DuesPreviewRow {
  source_row: number;
  block: string;
  lot: string;
  source_resident_name: string;
  system_resident_name: string | null;
  status: 'Ready' | 'Review' | 'No payment';
  payment_count: number;
  amount_paid: number;
  regular_dues: number;
  penalty_amount: number;
  issues: string[];
  notes: string[];
}

interface DuesPreview {
  year: number;
  summary: {
    source_rows: number;
    payment_rows: number;
    payment_entries: number;
    ready_entries: number;
    review_entries: number;
    total_amount_paid: number;
    total_regular_dues: number;
    total_penalties: number;
  };
  rows: DuesPreviewRow[];
}

interface Props {
  isOpen: boolean;
  token: string | null;
  onClose: () => void;
}

const normalizeHeader = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

const parseCsv = (source: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const text = source.replace(/^\uFEFF/, '');

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if (character === '\n' && !quoted) {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (character !== '\r') {
      cell += character;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
};

const buildRecords = (source: string): DuesRecord[] => {
  const csvRows = parseCsv(source).filter((row) => row.some((value) => value.trim() !== ''));
  const [headerRow, ...dataRows] = csvRows;

  if (!headerRow) {
    throw new Error('The selected file is empty. Download the HOA DUES tab as a CSV file first.');
  }

  const headers = new Map(headerRow.map((value, index) => [normalizeHeader(value), index]));
  const requiredHeaders = ['block', 'lot', 'last name', 'first name', 'total', ...MONTHS.map((month) => month.toLowerCase())];
  const missingHeaders = requiredHeaders.filter((header) => !headers.has(header));

  if (missingHeaders.length > 0) {
    throw new Error(`This is not the HOA dues CSV. Missing column: ${missingHeaders[0]}.`);
  }

  const valueFor = (row: string[], header: string) => row[headers.get(header) ?? -1]?.trim() ?? '';

  return dataRows.map((row, index) => ({
    source_row: index + 2,
    block: valueFor(row, 'block'),
    lot: valueFor(row, 'lot'),
    first_name: valueFor(row, 'first name'),
    last_name: valueFor(row, 'last name'),
    total: valueFor(row, 'total'),
    months: Object.fromEntries(MONTHS.map((month) => [month, valueFor(row, month.toLowerCase())])),
  }));
};

const formatPeso = (value: number) => `₱${Number(value || 0).toLocaleString(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;

const DuesImportPreviewModal = ({ isOpen, token, onClose }: Props) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<DuesPreview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const reset = () => {
    setSelectedFile(null);
    setPreview(null);
    setError('');
  };

  const close = () => {
    reset();
    onClose();
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(event.target.files?.[0] ?? null);
    setPreview(null);
    setError('');
  };

  const createPreview = async () => {
    if (!selectedFile || !token) return;

    setIsLoading(true);
    setError('');

    try {
      const records = buildRecords(await selectedFile.text());
      const response = await axios.post<DuesPreview>(
        `${API_BASE_URL}/api/officer/preview_legacy_dues.php`,
        { year: 2026, records },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setPreview(response.data);
    } catch (requestError) {
      const message = axios.isAxiosError(requestError)
        ? requestError.response?.data?.message ?? 'SmartHOA could not prepare the dues preview.'
        : requestError instanceof Error
          ? requestError.message
          : 'SmartHOA could not prepare the dues preview.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const displayRows = preview?.rows.filter((row) => row.payment_count > 0).slice(0, 100) ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-gray-800">2026 HOA Dues Import Preview</h3>
            <p className="mt-1 text-sm text-gray-500">Check the sheet before any payment history is saved.</p>
          </div>
          <button onClick={close} className="text-gray-400 transition-colors hover:text-gray-600" aria-label="Close preview">
            <X size={22} />
          </button>
        </div>

        <div className="overflow-y-auto p-6">
          {!preview ? (
            <div className="mx-auto max-w-2xl space-y-5">
              <div className="rounded-2xl border border-brown/10 bg-cream p-5">
                <div className="flex gap-3">
                  <FileSpreadsheet className="mt-0.5 shrink-0 text-brown" size={24} />
                  <div className="space-y-2 text-sm text-gray-700">
                    <p className="font-semibold text-gray-800">Use the HOA DUES sheet exported as a CSV file.</p>
                    <p>Each amount is treated as a payment received. ₱325 is regular dues; any amount above ₱325 is calculated as a late-payment penalty.</p>
                    <p>Move-in notes, missing property or resident matches, number errors, and incorrect totals are flagged for review. This preview does not import or change any payment records.</p>
                  </div>
                </div>
              </div>

              <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 px-6 text-center transition-colors hover:border-brown hover:bg-cream/50">
                <UploadCloud className="mb-3 text-gray-400" size={34} />
                <span className="font-semibold text-gray-700">{selectedFile ? selectedFile.name : 'Choose the HOA DUES CSV file'}</span>
                <span className="mt-1 text-sm text-gray-500">Google Sheets: File → Download → Comma-separated values (.csv)</span>
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />
              </label>

              {error && (
                <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  <AlertTriangle className="shrink-0" size={18} />
                  <p>{error}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800 sm:flex-row sm:items-center sm:justify-between">
                <span><strong>Preview only.</strong> No payment history has been added to SmartHOA.</span>
                <button onClick={reset} className="font-semibold underline underline-offset-2">Choose another file</button>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <SummaryCard label="Source rows" value={String(preview.summary.source_rows)} />
                <SummaryCard label="Payment entries" value={String(preview.summary.payment_entries)} />
                <SummaryCard label="Ready to import" value={String(preview.summary.ready_entries)} tone="green" />
                <SummaryCard label="Needs review" value={String(preview.summary.review_entries)} tone={preview.summary.review_entries > 0 ? 'amber' : 'green'} />
                <SummaryCard label="Recorded payments" value={formatPeso(preview.summary.total_amount_paid)} />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <SummaryCard label="Regular dues at ₱325" value={formatPeso(preview.summary.total_regular_dues)} />
                <SummaryCard label="Late-payment penalties" value={formatPeso(preview.summary.total_penalties)} tone="amber" />
                <SummaryCard label="Properties with payments" value={String(preview.summary.payment_rows)} />
              </div>

              <div className="overflow-hidden rounded-2xl border border-gray-100">
                <div className="border-b border-gray-100 bg-gray-50 px-5 py-4">
                  <h4 className="font-bold text-gray-800">Payment rows</h4>
                  <p className="mt-1 text-sm text-gray-500">Showing the first {displayRows.length} properties with recorded payments.</p>
                </div>
                <div className="max-h-[42vh] overflow-auto">
                  <table className="w-full min-w-[980px] text-left">
                    <thead className="sticky top-0 bg-white text-xs uppercase tracking-wider text-gray-500">
                      <tr className="border-b border-gray-100">
                        <th className="px-5 py-3">Property</th>
                        <th className="px-5 py-3">Sheet resident</th>
                        <th className="px-5 py-3">System match</th>
                        <th className="px-5 py-3">Payments</th>
                        <th className="px-5 py-3">Regular dues</th>
                        <th className="px-5 py-3">Penalty</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3">Review notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {displayRows.map((row) => (
                        <tr key={`${row.source_row}-${row.block}-${row.lot}`} className="align-top hover:bg-gray-50/60">
                          <td className="px-5 py-4 font-semibold text-gray-800">Blk {row.block || '—'}, Lot {row.lot || '—'}</td>
                          <td className="px-5 py-4 text-gray-700">{row.source_resident_name || 'Not provided'}</td>
                          <td className="px-5 py-4 text-gray-700">{row.system_resident_name ?? 'No matching resident'}</td>
                          <td className="px-5 py-4 text-gray-700">{row.payment_count} · {formatPeso(row.amount_paid)}</td>
                          <td className="px-5 py-4 text-gray-700">{formatPeso(row.regular_dues)}</td>
                          <td className="px-5 py-4 text-gray-700">{formatPeso(row.penalty_amount)}</td>
                          <td className="px-5 py-4"><StatusBadge status={row.status} /></td>
                          <td className="max-w-xs px-5 py-4 text-xs leading-5 text-gray-600">
                            {[...row.issues, ...row.notes].join(' · ') || 'No issues found'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4">
          <button onClick={close} className="rounded-xl px-5 py-2.5 font-semibold text-gray-600 transition-colors hover:bg-gray-200">
            Close
          </button>
          {!preview && (
            <button
              onClick={createPreview}
              disabled={!selectedFile || isLoading}
              className={`flex items-center gap-2 rounded-xl px-5 py-2.5 font-semibold text-white transition-colors ${
                !selectedFile || isLoading ? 'cursor-not-allowed bg-brown/50' : 'bg-brown hover:bg-brown-dark'
              }`}
            >
              {isLoading ? <LoaderCircle className="animate-spin" size={18} /> : <FileSpreadsheet size={18} />}
              {isLoading ? 'Checking file...' : 'Create Preview'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const SummaryCard = ({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'green' | 'amber' }) => {
  const colorClass = tone === 'green' ? 'text-green-700' : tone === 'amber' ? 'text-amber-700' : 'text-gray-800';
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`mt-2 text-xl font-bold ${colorClass}`}>{value}</p>
    </div>
  );
};

const StatusBadge = ({ status }: { status: DuesPreviewRow['status'] }) => {
  if (status === 'Ready') {
    return <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700"><CheckCircle2 size={12} /> Ready</span>;
  }
  if (status === 'Review') {
    return <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700"><AlertTriangle size={12} /> Review</span>;
  }
  return <span className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-600">No payment</span>;
};

export default DuesImportPreviewModal;
