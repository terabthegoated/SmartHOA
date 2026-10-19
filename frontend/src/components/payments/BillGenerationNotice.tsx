import type { Ref } from 'react';
import { AlertCircle, Search } from 'lucide-react';

export interface BillGenerationIssue {
  kind: 'duplicate' | 'error';
  message: string;
  billingLabel?: string;
}

export default function BillGenerationNotice({ issue, noticeRef, onReview }: {
  issue: BillGenerationIssue;
  noticeRef?: Ref<HTMLDivElement>;
  onReview: () => void;
}) {
  const duplicate = issue.kind === 'duplicate';
  return (
    <div ref={noticeRef} role="alert" tabIndex={-1}
      className={`rounded-xl border p-4 outline-none focus:ring-2 focus:ring-offset-2 ${duplicate
        ? 'border-amber-200 bg-amber-50 focus:ring-amber-300'
        : 'border-red-200 bg-red-50 focus:ring-red-300'}`}>
      <div className="flex items-start gap-3">
        <AlertCircle size={20} aria-hidden="true" className={`mt-0.5 shrink-0 ${duplicate ? 'text-amber-700' : 'text-red-600'}`} />
        <div className="min-w-0">
          <h4 className={`text-sm font-bold ${duplicate ? 'text-amber-900' : 'text-red-800'}`}>
            {duplicate ? `A bill already exists for ${issue.billingLabel || 'the selected billing month'}` : 'Bill could not be created'}
          </h4>
          <p className={`mt-1 break-words text-sm leading-5 ${duplicate ? 'text-amber-800' : 'text-red-700'}`}>{issue.message}</p>
          {duplicate && <>
            <p className="mt-2 text-xs text-amber-800">No new bill was created. Your form details have been kept.</p>
            <button type="button" onClick={onReview}
              className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-900 transition-colors hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-400">
              <Search size={16} aria-hidden="true" /> Review existing bills
            </button>
          </>}
        </div>
      </div>
    </div>
  );
}
