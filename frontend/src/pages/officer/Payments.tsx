import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import axios from 'axios';
import { Search, Plus, CheckCircle2, XCircle, Clock, FileText, X, Image as ImageIcon, Download, FileSpreadsheet, BellRing, AlertCircle, Gavel } from 'lucide-react';
import { API_BASE_URL } from '../../config/api';
import DuesImportPreviewModal from '../../components/payments/DuesImportPreviewModal';

interface Payment {
  payment_id: string;
  amount_due: string;
  due_date: string;
  billing_month: string;
  payment_status: 'Pending' | 'Paid' | 'Overdue';
  type_name: string;
  first_name: string;
  last_name: string;
  block: string;
  lot: string;
  receipt_url: string | null;
}

interface PaymentType {
  payment_type_id: string;
  payment_name: string;
  description: string;
}

interface Resident {
  resident_id: string;
  first_name: string;
  last_name: string;
  block: string;
  lot: string;
}

interface ReminderResult {
  status: 'success' | 'error';
  message: string;
  eligible?: number;
  sent?: number;
  alreadySent?: number;
  skipped?: number;
}

interface CollectionPolicyResult {
  status: 'success' | 'error';
  message: string;
  billsGenerated?: number;
  billsMarkedOverdue?: number;
  assessmentsCreated?: number;
  hearingReviewsFlagged?: number;
  remindersSent?: number;
}

const BILL_TYPE_ORDER = [
  'Monthly HOA Dues',
  'Monthly HOA Dues + Penalty',
  'Car Sticker',
  'Construction Fee',
  'Membership Fee',
];

const Payments = () => {
  const { token } = useAuthStore();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentTypes, setPaymentTypes] = useState<PaymentType[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImportPreviewOpen, setIsImportPreviewOpen] = useState(false);
  const [isSendingReminders, setIsSendingReminders] = useState(false);
  const [reminderResult, setReminderResult] = useState<ReminderResult | null>(null);
  const [isRunningCollectionPolicy, setIsRunningCollectionPolicy] = useState(false);
  const [isCollectionPolicyConfirmOpen, setIsCollectionPolicyConfirmOpen] = useState(false);
  const [collectionPolicyResult, setCollectionPolicyResult] = useState<CollectionPolicyResult | null>(null);

  // Generate form state
  const [selectedResidentId, setSelectedResidentId] = useState('');
  const [residentSearch, setResidentSearch] = useState('');
  const [isResidentPickerOpen, setIsResidentPickerOpen] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');

  // Verify modal state
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState<Payment | null>(null);
  const [isApproving, setIsApproving] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [paymentsRes, typesRes, residentsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/officer/get_payments.php`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_BASE_URL}/api/officer/get_payment_types.php`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_BASE_URL}/api/officer/get_residents.php`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setPayments(paymentsRes.data);
      setPaymentTypes(typesRes.data);
      setResidents(residentsRes.data);
    } catch (error) {
      console.error("Failed to load data", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchData();
  }, [token]);

  const selectedResident = residents.find((resident) => resident.resident_id === selectedResidentId);
  const normalizedResidentSearch = residentSearch.trim().toLowerCase();
  const residentMatches = residents.filter((resident) => {
    if (!normalizedResidentSearch) return true;

    const searchableDetails = [
      `${resident.first_name} ${resident.last_name}`,
      resident.first_name,
      resident.last_name,
      resident.block ? `block ${resident.block}` : '',
      resident.block ? `blk ${resident.block}` : '',
      resident.lot ? `lot ${resident.lot}` : '',
      resident.block && resident.lot ? `block ${resident.block} lot ${resident.lot}` : '',
      resident.block && resident.lot ? `${resident.block} ${resident.lot}` : '',
    ];

    return searchableDetails.some((detail) => detail.toLowerCase().includes(normalizedResidentSearch));
  }).slice(0, 12);

  const availableBillTypes = BILL_TYPE_ORDER
    .map((paymentName) => paymentTypes.find((type) => type.payment_name.trim().toLowerCase() === paymentName.toLowerCase()))
    .filter((type): type is PaymentType => Boolean(type));

  const selectResident = (resident: Resident) => {
    setSelectedResidentId(resident.resident_id);
    setResidentSearch('');
    setIsResidentPickerOpen(false);
  };

  const clearResidentSelection = () => {
    setSelectedResidentId('');
    setResidentSearch('');
    setIsResidentPickerOpen(true);
  };

  const handleBillTypeChange = (paymentTypeId: string) => {
    setSelectedTypeId(paymentTypeId);

    const selectedType = paymentTypes.find((type) => type.payment_type_id === paymentTypeId);
    if (selectedType?.payment_name === 'Monthly HOA Dues' && !amount) {
      setAmount('325');
    }
  };

  const handleGenerateBill = async () => {
    if (!selectedResidentId || !selectedTypeId || !amount || !dueDate) return;
    setIsGenerating(true);

    try {
      await axios.post(`${API_BASE_URL}/api/officer/generate_dues.php`, {
        resident_id: selectedResidentId,
        payment_type_id: selectedTypeId,
        amount_due: amount,
        due_date: dueDate
      }, { headers: { Authorization: `Bearer ${token}` } });
      
      await fetchData();
      setIsGenerateModalOpen(false);
      
      // Reset form
      setSelectedResidentId('');
      setSelectedTypeId('');
      setAmount('');
      setDueDate('');
    } catch (error) {
      console.error("Failed to generate bill", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApprovePayment = async () => {
    if (!verifyingPayment) return;
    setIsApproving(true);
    
    try {
      await axios.post(`${API_BASE_URL}/api/officer/approve_payment.php`, {
        payment_id: verifyingPayment.payment_id
      }, { headers: { Authorization: `Bearer ${token}` } });
      
      await fetchData();
      setIsVerifyModalOpen(false);
    } catch (error) {
      console.error("Failed to approve payment", error);
    } finally {
      setIsApproving(false);
    }
  };

  const getReminderNumber = (data: Record<string, unknown>, keys: string[]) => {
    for (const key of keys) {
      const value = data[key];
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
    }
    return undefined;
  };

  const handleSendPaymentReminders = async () => {
    if (isSendingReminders) return;

    setReminderResult(null);
    setIsSendingReminders(true);

    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/officer/send_payment_reminders.php`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const data = response.data && typeof response.data === 'object'
        ? response.data as Record<string, unknown>
        : {};

      if (data.success === false || data.status === 'error') {
        throw new Error(typeof data.message === 'string' ? data.message : 'Payment reminders could not be sent.');
      }

      const summary = data.summary && typeof data.summary === 'object'
        ? data.summary as Record<string, unknown>
        : data;
      const sent = getReminderNumber(summary, ['sent', 'sent_count', 'notifications_sent']);
      const eligible = getReminderNumber(summary, ['eligible', 'eligible_count', 'eligible_residents']);
      const alreadySent = getReminderNumber(summary, ['already_sent', 'alreadySent', 'already_sent_count']);
      const skipped = getReminderNumber(summary, ['skipped', 'skipped_count']);

      setReminderResult({
        status: 'success',
        message: typeof data.message === 'string'
          ? data.message
          : 'Payment reminders were processed successfully.',
        eligible,
        sent,
        alreadySent,
        skipped,
      });
    } catch (error) {
      const axiosMessage = axios.isAxiosError(error) && error.response?.data && typeof error.response.data === 'object'
        ? (error.response.data as Record<string, unknown>).message
        : undefined;

      setReminderResult({
        status: 'error',
        message: typeof axiosMessage === 'string'
          ? axiosMessage
          : error instanceof Error
            ? error.message
            : 'Payment reminders could not be sent. Please try again.',
      });
    } finally {
      setIsSendingReminders(false);
    }
  };

  const openCollectionPolicyConfirm = () => {
    if (isRunningCollectionPolicy) return;
    setCollectionPolicyResult(null);
    setIsCollectionPolicyConfirmOpen(true);
  };

  const handleRunCollectionPolicy = async () => {
    if (isRunningCollectionPolicy) return;

    setIsCollectionPolicyConfirmOpen(false);
    setIsRunningCollectionPolicy(true);

    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/officer/run_dues_collection_policy.php`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = response.data && typeof response.data === 'object'
        ? response.data as Record<string, unknown>
        : {};
      const summary = data.summary && typeof data.summary === 'object'
        ? data.summary as Record<string, unknown>
        : data;
      const reminders = summary.reminders && typeof summary.reminders === 'object'
        ? summary.reminders as Record<string, unknown>
        : {};

      setCollectionPolicyResult({
        status: 'success',
        message: typeof data.message === 'string' ? data.message : 'Collection policy completed.',
        billsGenerated: getReminderNumber(summary, ['monthly_bills_generated']),
        billsMarkedOverdue: getReminderNumber(summary, ['bills_marked_overdue']),
        assessmentsCreated: getReminderNumber(summary, ['assessments_created']),
        hearingReviewsFlagged: getReminderNumber(summary, ['hearing_reviews_flagged']),
        remindersSent: getReminderNumber(reminders, ['sent']),
      });
      await fetchData();
    } catch (error) {
      const axiosMessage = axios.isAxiosError(error) && error.response?.data && typeof error.response.data === 'object'
        ? (error.response.data as Record<string, unknown>).message
        : undefined;
      setCollectionPolicyResult({
        status: 'error',
        message: typeof axiosMessage === 'string'
          ? axiosMessage
          : 'The collection policy could not be completed. Please try again.'
      });
    } finally {
      setIsRunningCollectionPolicy(false);
    }
  };

  const filteredPayments = payments.filter(p => 
    `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.type_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exportToCSV = () => {
    if (filteredPayments.length === 0) return;
    
    const headers = ['Payment ID', 'Resident', 'Block', 'Lot', 'Bill Type', 'Amount Due', 'Due Date', 'Status'];
    const rows = filteredPayments.map(p => [
      p.payment_id,
      `"${p.first_name} ${p.last_name}"`,
      p.block || 'N/A',
      p.lot || 'N/A',
      p.type_name,
      p.amount_due,
      new Date(p.due_date).toLocaleDateString(),
      p.payment_status
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `SmartHOA_Payments_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: string, receiptUrl: string | null) => {
    if (status === 'Pending' && receiptUrl) {
      return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200"><Clock size={12} /> Pending Verification</span>;
    }
    switch (status) {
      case 'Paid':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-green-50 text-green-700 border border-green-200"><CheckCircle2 size={12} /> Paid</span>;
      case 'Pending':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-orange-50 text-orange-700 border border-orange-200"><Clock size={12} /> Unpaid</span>;
      case 'Overdue':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-red-50 text-red-700 border border-red-200"><XCircle size={12} /> Overdue</span>;
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-gray-800 sm:text-3xl">Payment Management</h1>
          <p className="text-gray-500 mt-2">Generate dues and monitor resident payments.</p>
        </div>
        
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center xl:justify-end">
          <div className="flex items-center bg-white rounded-xl px-4 py-2 w-full sm:w-72 border border-gray-200 focus-within:border-brown focus-within:ring-1 focus-within:ring-brown transition-all shadow-sm">
            <Search className="w-5 h-5 text-gray-400 mr-3" />
            <input 
              type="text" 
              placeholder="Search bills..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent border-none outline-none w-full text-sm placeholder-gray-400"
            />
          </div>
          <button
            onClick={handleSendPaymentReminders}
            disabled={isSendingReminders}
            className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-5 py-2.5 font-semibold shadow-sm transition-colors sm:w-auto ${
              isSendingReminders
                ? 'cursor-not-allowed border-brown/20 bg-cream text-brown/60'
                : 'border-brown/20 bg-cream text-brown hover:bg-brown hover:text-white'
            }`}
          >
            <BellRing size={18} />
            {isSendingReminders ? 'Sending reminders...' : 'Send payment reminders'}
          </button>
          <button
            onClick={openCollectionPolicyConfirm}
            disabled={isRunningCollectionPolicy}
            className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-5 py-2.5 font-semibold shadow-sm transition-colors sm:w-auto ${
              isRunningCollectionPolicy
                ? 'cursor-not-allowed border-brown/20 bg-cream text-brown/60'
                : 'border-brown/20 bg-white text-brown hover:bg-cream'
            }`}
          >
            <Gavel size={18} />
            {isRunningCollectionPolicy ? 'Running policy...' : 'Run collection policy'}
          </button>
          <button 
            onClick={exportToCSV}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 sm:w-auto"
          >
            <Download size={18} />
            Export CSV
          </button>
          <button
            onClick={() => setIsImportPreviewOpen(true)}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-brown/20 bg-white px-5 py-2.5 font-semibold text-brown shadow-sm transition-colors hover:bg-cream sm:w-auto"
          >
            <FileSpreadsheet size={18} />
            Import 2026 Dues
          </button>
          <button 
            onClick={() => setIsGenerateModalOpen(true)}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brown px-5 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-brown-dark sm:w-auto"
          >
            <Plus size={18} />
            Generate Bill
          </button>
        </div>
      </div>

      {collectionPolicyResult && (
        <div className={`rounded-xl border p-4 text-sm ${
          collectionPolicyResult.status === 'success'
            ? 'border-green-200 bg-green-50 text-green-800'
            : 'border-red-200 bg-red-50 text-red-700'
        }`}>
          <p className="font-bold">{collectionPolicyResult.message}</p>
          {collectionPolicyResult.status === 'success' && (
            <p className="mt-1 leading-6">
              {collectionPolicyResult.billsGenerated ?? 0} new monthly bill(s), {collectionPolicyResult.billsMarkedOverdue ?? 0} bill(s) marked overdue, {collectionPolicyResult.assessmentsCreated ?? 0} policy assessment(s), {collectionPolicyResult.remindersSent ?? 0} reminder(s) sent.
              {(collectionPolicyResult.hearingReviewsFlagged ?? 0) > 0 && ` ${collectionPolicyResult.hearingReviewsFlagged} account(s) require hearing review; no account was automatically frozen.`}
            </p>
          )}
        </div>
      )}

      {reminderResult && (
        <div
          role={reminderResult.status === 'error' ? 'alert' : 'status'}
          aria-live="polite"
          className={`rounded-2xl border px-4 py-3 shadow-sm sm:flex sm:items-start sm:justify-between sm:gap-4 ${
            reminderResult.status === 'success'
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          <div className="flex min-w-0 gap-3">
            {reminderResult.status === 'success' ? (
              <CheckCircle2 size={20} className="mt-0.5 shrink-0" />
            ) : (
              <AlertCircle size={20} className="mt-0.5 shrink-0" />
            )}
            <div>
              <p className="font-semibold">
                {reminderResult.status === 'success' ? 'Payment reminder update' : 'Unable to send reminders'}
              </p>
              <p className="mt-0.5 text-sm">{reminderResult.message}</p>
              {(reminderResult.eligible !== undefined || reminderResult.sent !== undefined || reminderResult.alreadySent !== undefined || reminderResult.skipped !== undefined) && (
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold">
                  {reminderResult.eligible !== undefined && <span>Eligible: {reminderResult.eligible}</span>}
                  {reminderResult.sent !== undefined && <span>Sent: {reminderResult.sent}</span>}
                  {reminderResult.alreadySent !== undefined && <span>Already sent: {reminderResult.alreadySent}</span>}
                  {reminderResult.skipped !== undefined && <span>Skipped: {reminderResult.skipped}</span>}
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setReminderResult(null)}
            className="mt-2 rounded-lg p-1 text-current/70 hover:bg-white/50 hover:text-current sm:mt-0"
            aria-label="Dismiss payment reminder update"
            title="Dismiss"
          >
            <X size={18} />
          </button>
        </div>
      )}

      <div className="space-y-3 md:hidden">
        {isLoading ? (
          [...Array(3)].map((_, index) => (
            <div key={index} className="h-52 animate-pulse rounded-2xl border border-gray-100 bg-white p-5 shadow-sm" />
          ))
        ) : filteredPayments.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-white px-5 py-12 text-center text-gray-400 shadow-sm">
            No payment records found.
          </div>
        ) : (
          filteredPayments.map((payment) => (
            <article key={payment.payment_id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-bold text-gray-800">{payment.first_name} {payment.last_name}</h2>
                  <p className="mt-0.5 text-sm text-gray-500">{payment.block && payment.lot ? `Blk ${payment.block}, Lot ${payment.lot}` : 'Property unassigned'}</p>
                </div>
                {getStatusBadge(payment.payment_status, payment.receipt_url)}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 border-y border-gray-100 py-4">
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400"><FileText size={14} /> Bill type</p>
                  <p className="mt-1 font-semibold text-gray-700">{payment.type_name}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Amount</p>
                  <p className="mt-1 text-lg font-bold text-gray-800">₱{parseFloat(payment.amount_due).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Due date</p>
                  <p className="mt-1 font-semibold text-gray-700">{new Date(payment.due_date).toLocaleDateString()}</p>
                </div>
              </div>

              <button
                type="button"
                disabled={payment.payment_status === 'Paid' && !payment.receipt_url}
                onClick={() => {
                  setVerifyingPayment(payment);
                  setIsVerifyModalOpen(true);
                }}
                className={`mt-4 flex min-h-11 w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                  payment.payment_status === 'Paid'
                    ? 'cursor-default border border-green-200 bg-green-50 text-green-700'
                    : payment.receipt_url
                      ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700'
                      : 'bg-brown/10 text-brown hover:bg-brown/20'
                }`}
              >
                {payment.payment_status === 'Paid' ? 'Settled' : payment.receipt_url ? 'Verify receipt' : 'View details'}
              </button>
            </article>
          ))
        )}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Resident</th>
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Bill Type</th>
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Due Date</th>
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-gray-400">Loading payments...</td>
                </tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-gray-400">No payment records found.</td>
                </tr>
              ) : (
                filteredPayments.map((payment) => (
                  <tr key={payment.payment_id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 px-6">
                      <p className="font-semibold text-gray-800">{payment.first_name} {payment.last_name}</p>
                      <p className="text-xs text-gray-500">
                        {payment.block && payment.lot ? `Blk ${payment.block}, Lot ${payment.lot}` : 'Unassigned'}
                      </p>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <FileText size={16} className="text-gray-400" />
                        <span className="font-medium text-gray-700">{payment.type_name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 font-bold text-gray-800">
                      ₱{parseFloat(payment.amount_due).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-600">
                      {new Date(payment.due_date).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-6">
                      {getStatusBadge(payment.payment_status, payment.receipt_url)}
                    </td>
                    <td className="py-4 px-6">
                      <button 
                        disabled={payment.payment_status === 'Paid' && !payment.receipt_url}
                        onClick={() => {
                          setVerifyingPayment(payment);
                          setIsVerifyModalOpen(true);
                        }}
                        className={`text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2 ${
                          payment.payment_status === 'Paid' 
                            ? 'text-green-700 bg-green-50 border border-green-200' 
                            : payment.receipt_url 
                              ? 'text-white bg-blue-600 hover:bg-blue-700 shadow-sm'
                              : 'text-brown hover:text-brown-dark bg-brown/10 hover:bg-brown/20'
                        }`}
                      >
                        {payment.payment_status === 'Paid' ? 'Settled' : payment.receipt_url ? 'Verify Receipt' : 'View Details'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isCollectionPolicyConfirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="collection-policy-title"
        >
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-gray-100 bg-cream/60 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brown/10 text-brown">
                  <Gavel size={20} />
                </div>
                <div>
                  <h3 id="collection-policy-title" className="font-bold text-gray-800">Run collection policy?</h3>
                  <p className="text-xs text-gray-500">This processes the current SmartHOA collection cycle.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCollectionPolicyConfirmOpen(false)}
                className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-white hover:text-gray-600"
                aria-label="Close collection policy confirmation"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 px-6 py-5 text-sm text-gray-600">
              <p className="leading-6">
                SmartHOA will review the current payment cycle and apply the Board-approved rules below.
              </p>
              <ul className="space-y-2 rounded-xl border border-gray-100 bg-gray-50 p-4 leading-5">
                <li><span className="font-semibold text-gray-800">• Missing monthly bills:</span> creates one ₱325 HOA-dues bill for each active resident with an assigned property.</li>
                <li><span className="font-semibold text-gray-800">• Unpaid bills after the 16th:</span> marks eligible bills as overdue and sends the appropriate in-app notice.</li>
                <li><span className="font-semibold text-gray-800">• Compounding interest:</span> records the 10% assessment after the payment due date.</li>
              </ul>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
                Payments already marked Paid and payments with a receipt awaiting verification will not be changed. Third-month cases are flagged for a hearing; no account is automatically frozen.
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setIsCollectionPolicyConfirmOpen(false)}
                className="rounded-xl px-5 py-2.5 font-semibold text-gray-600 transition-colors hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRunCollectionPolicy}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brown px-5 py-2.5 font-semibold text-white transition-colors hover:bg-brown-dark"
              >
                <Gavel size={18} />
                Run policy now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Verify Payment Modal */}
      {isVerifyModalOpen && verifyingPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">Verify Payment</h3>
              <button onClick={() => setIsVerifyModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-gray-800 text-lg">{verifyingPayment.first_name} {verifyingPayment.last_name}</h4>
                  <p className="text-sm text-gray-500">{verifyingPayment.block && verifyingPayment.lot ? `Blk ${verifyingPayment.block}, Lot ${verifyingPayment.lot}` : 'Unassigned Property'}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500 font-semibold mb-1">Amount Due</p>
                  <h3 className="text-2xl font-bold text-brown">₱{parseFloat(verifyingPayment.amount_due).toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2"><ImageIcon size={16} /> Proof of Payment</p>
                {verifyingPayment.receipt_url ? (
                  <div className="bg-gray-100 rounded-xl overflow-hidden border border-gray-200 flex justify-center items-center h-64">
                    <img 
                      src={`${API_BASE_URL}${verifyingPayment.receipt_url}`} 
                      alt="Receipt" 
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl h-32 flex flex-col items-center justify-center text-gray-400">
                    <XCircle size={32} className="mb-2" />
                    <p className="text-sm">No receipt uploaded yet.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center bg-gray-50">
              <span className="text-xs text-gray-500">Bill Type: <strong>{verifyingPayment.type_name}</strong></span>
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsVerifyModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl font-semibold text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  Close
                </button>
                {verifyingPayment.payment_status !== 'Paid' && verifyingPayment.receipt_url && (
                  <button 
                    onClick={handleApprovePayment}
                    disabled={isApproving}
                    className={`px-5 py-2.5 rounded-xl font-semibold text-white flex items-center gap-2 transition-colors ${
                      isApproving ? 'bg-green-500/50 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    {isApproving ? 'Approving...' : 'Approve Payment'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generate Bill Modal */}
      {isGenerateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] shadow-xl overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">Generate New Bill</h3>
              <button onClick={() => setIsGenerateModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label htmlFor="resident-search" className="block text-sm font-semibold text-gray-700 mb-2">Find Resident</label>
                <div className="relative">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    id="resident-search"
                    type="search"
                    autoComplete="off"
                    placeholder="Type a name, block, or lot..."
                    className="w-full border border-gray-200 rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:border-brown focus:ring-1 focus:ring-brown bg-white"
                    value={residentSearch}
                    onFocus={() => setIsResidentPickerOpen(true)}
                    onChange={(e) => {
                      setResidentSearch(e.target.value);
                      setIsResidentPickerOpen(true);
                    }}
                    role="combobox"
                    aria-expanded={isResidentPickerOpen}
                    aria-controls="resident-results"
                    aria-autocomplete="list"
                  />
                </div>

                {selectedResident ? (
                  <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-brown/20 bg-cream px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-800">{selectedResident.first_name} {selectedResident.last_name}</p>
                      <p className="text-xs text-gray-500">
                        {selectedResident.block && selectedResident.lot
                          ? `Block ${selectedResident.block}, Lot ${selectedResident.lot}`
                          : 'No assigned block and lot'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={clearResidentSelection}
                      className="shrink-0 rounded-lg p-1 text-gray-500 hover:bg-white hover:text-gray-700"
                      aria-label="Choose a different resident"
                      title="Choose a different resident"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-gray-500">Search by resident name, Block No., or Lot No.</p>
                )}

                {isResidentPickerOpen && (
                  <div id="resident-results" role="listbox" className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
                    {residentMatches.length > 0 ? (
                      residentMatches.map((resident) => (
                        <button
                          key={resident.resident_id}
                          type="button"
                          role="option"
                          aria-selected={resident.resident_id === selectedResidentId}
                          onClick={() => selectResident(resident)}
                          className={`w-full px-4 py-3 text-left transition-colors hover:bg-cream focus:bg-cream focus:outline-none ${
                            resident.resident_id === selectedResidentId ? 'bg-cream' : 'bg-white'
                          }`}
                        >
                          <span className="block text-sm font-semibold text-gray-800">{resident.first_name} {resident.last_name}</span>
                          <span className="block text-xs text-gray-500">
                            {resident.block && resident.lot ? `Block ${resident.block}, Lot ${resident.lot}` : 'No assigned block and lot'}
                          </span>
                        </button>
                      ))
                    ) : (
                      <p className="px-4 py-3 text-sm text-gray-500">No resident matches that search.</p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Bill Type</label>
                <select 
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-brown focus:ring-1 focus:ring-brown bg-white"
                  value={selectedTypeId}
                  onChange={(e) => handleBillTypeChange(e.target.value)}
                >
                  <option value="" disabled>Choose type...</option>
                  {availableBillTypes.map(t => (
                    <option key={t.payment_type_id} value={t.payment_type_id}>
                      {t.payment_name}
                    </option>
                  ))}
                </select>
                {paymentTypes.length > 0 && availableBillTypes.length === 0 && (
                  <p className="mt-2 text-xs text-red-600">No approved bill types are available yet. Please update the payment types first.</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Amount (₱)</label>
                  <input 
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-brown focus:ring-1 focus:ring-brown bg-white"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Due Date</label>
                  <input 
                    type="date"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-brown focus:ring-1 focus:ring-brown bg-white"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
              <button 
                onClick={() => setIsGenerateModalOpen(false)}
                className="px-5 py-2.5 rounded-xl font-semibold text-gray-600 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleGenerateBill}
                disabled={!selectedResidentId || !selectedTypeId || !amount || !dueDate || isGenerating}
                className={`px-5 py-2.5 rounded-xl font-semibold text-white flex items-center gap-2 transition-colors ${
                  !selectedResidentId || !selectedTypeId || !amount || !dueDate || isGenerating ? 'bg-brown/50 cursor-not-allowed' : 'bg-brown hover:bg-brown-dark'
                }`}
              >
                {isGenerating ? 'Generating...' : 'Confirm Bill'}
              </button>
            </div>
          </div>
        </div>
      )}

      <DuesImportPreviewModal
        isOpen={isImportPreviewOpen}
        token={token}
        onClose={() => setIsImportPreviewOpen(false)}
        onImported={() => { void fetchData(); }}
      />
    </div>
  );
};

export default Payments;
