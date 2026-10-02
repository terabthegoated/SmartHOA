import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import axios from 'axios';
import { Search, CheckCircle2, XCircle, Clock, FileText, UploadCloud, FileImage } from 'lucide-react';
import { API_BASE_URL } from '../../config/api';

interface Payment {
  payment_id: string;
  amount_due: string;
  due_date: string;
  billing_month: string;
  payment_status: 'Pending' | 'Paid' | 'Overdue';
  type_name: string;
  has_receipt: boolean;
}

const MyPayments = () => {
  const { token } = useAuthStore();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Upload modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/resident/get_my_payments.php`, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      setPayments(response.data);
    } catch (error) {
      console.error("Failed to load personal payments", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchData();
  }, [token]);

  const handleOpenUpload = (payment: Payment) => {
    setSelectedPayment(payment);
    setReceiptFile(null);
    setUploadSuccess(false);
    setIsModalOpen(true);
  };

  const handleUploadReceipt = async () => {
    if (!selectedPayment || !receiptFile) return;
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('payment_id', selectedPayment.payment_id);
      formData.append('receipt', receiptFile);

      await axios.post(`${API_BASE_URL}/api/resident/upload_receipt.php`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setUploadSuccess(true);
      
      // Update local state to reflect receipt upload
      setPayments(payments.map(p => 
        p.payment_id === selectedPayment.payment_id ? { ...p, has_receipt: true } : p
      ));

      setTimeout(() => {
        setIsModalOpen(false);
      }, 2000);
    } catch (error) {
      console.error("Failed to upload receipt", error);
      alert("Failed to upload receipt. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const filteredPayments = payments.filter(p => 
    p.type_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string, hasReceipt: boolean) => {
    if (status === 'Pending' && hasReceipt) {
      return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200"><Clock size={12} /> In Review</span>;
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-gray-800 sm:text-3xl">My Bills & Payments</h1>
          <p className="text-gray-500 mt-2">View your outstanding balances and payment history.</p>
        </div>
        
        <div className="flex w-full items-center rounded-xl border border-gray-200 bg-white px-4 py-2 shadow-sm transition-all focus-within:border-brown focus-within:ring-1 focus-within:ring-brown sm:w-72">
          <Search className="w-5 h-5 text-gray-400 mr-3" />
          <input 
            type="text" 
            placeholder="Search my bills..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent border-none outline-none w-full text-sm placeholder-gray-400"
          />
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {isLoading ? (
          [...Array(3)].map((_, index) => (
            <div key={index} className="h-48 animate-pulse rounded-2xl border border-gray-100 bg-white p-5 shadow-sm" />
          ))
        ) : filteredPayments.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-white px-5 py-12 text-center text-gray-400 shadow-sm">
            No bills found for your account.
          </div>
        ) : (
          filteredPayments.map((payment) => (
            <article key={payment.payment_id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <FileText size={17} className="shrink-0 text-brown" />
                    <h2 className="font-bold text-gray-800">{payment.type_name}</h2>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {new Date(payment.billing_month).toLocaleDateString('default', { month: 'long', year: 'numeric' })}
                  </p>
                </div>
                {getStatusBadge(payment.payment_status, payment.has_receipt)}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 border-y border-gray-100 py-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Amount</p>
                  <p className="mt-1 text-lg font-bold text-gray-800">₱{parseFloat(payment.amount_due).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Due date</p>
                  <p className="mt-1 font-semibold text-gray-700">{new Date(payment.due_date).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="mt-4">
                {payment.payment_status === 'Paid' ? (
                  <span className="inline-flex rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-500">Settled</span>
                ) : payment.has_receipt ? (
                  <span className="inline-flex rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-600">Under Review</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleOpenUpload(payment)}
                    className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brown px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brown-dark"
                  >
                    <UploadCloud size={17} /> Pay Bill
                  </button>
                )}
              </div>
            </article>
          ))
        )}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Bill Type</th>
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Billing Month</th>
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Due Date</th>
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-gray-400">Loading your bills...</td>
                </tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-gray-400">No bills found for your account.</td>
                </tr>
              ) : (
                filteredPayments.map((payment) => (
                  <tr key={payment.payment_id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <FileText size={16} className="text-gray-400" />
                        <span className="font-semibold text-gray-800">{payment.type_name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-600">
                      {new Date(payment.billing_month).toLocaleDateString('default', { month: 'long', year: 'numeric' })}
                    </td>
                    <td className="py-4 px-6 font-bold text-gray-800">
                      ₱{parseFloat(payment.amount_due).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-600">
                      {new Date(payment.due_date).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-6">
                      {getStatusBadge(payment.payment_status, payment.has_receipt)}
                    </td>
                    <td className="py-4 px-6">
                      {payment.payment_status === 'Paid' ? (
                        <span className="text-sm font-semibold text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg">Settled</span>
                      ) : payment.has_receipt ? (
                        <span className="text-sm font-semibold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">Under Review</span>
                      ) : (
                        <button 
                          onClick={() => handleOpenUpload(payment)}
                          className="text-sm font-semibold text-brown hover:text-brown-dark bg-brown/10 hover:bg-brown/20 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2"
                        >
                          <UploadCloud size={16} /> Pay Bill
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload Receipt Modal */}
      {isModalOpen && selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 backdrop-blur-sm animate-in fade-in duration-200 sm:p-4">
          <div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl animate-in zoom-in-95 duration-200 sm:max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">Submit Payment</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <XCircle size={20} />
              </button>
            </div>
            
            <div className="space-y-4 overflow-y-auto p-5 sm:p-6">
              <div className="bg-cream p-4 rounded-xl border border-brown/10">
                <p className="text-sm text-gray-500 font-semibold mb-1">Total Amount Due</p>
                <h2 className="text-3xl font-bold text-brown">₱{parseFloat(selectedPayment.amount_due).toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
                <p className="text-sm text-gray-600 mt-2">For: <strong>{selectedPayment.type_name}</strong></p>
              </div>

              {uploadSuccess ? (
                <div className="p-6 text-center animate-in zoom-in-50 duration-300">
                  <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 size={32} />
                  </div>
                  <h3 className="font-bold text-gray-800 text-lg">Receipt Submitted!</h3>
                  <p className="text-gray-500 text-sm mt-1">An officer will verify your payment shortly.</p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Upload Proof of Payment (Image)</label>
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors bg-white group">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <FileImage className="w-8 h-8 text-gray-400 group-hover:text-brown mb-2 transition-colors" />
                      <p className="text-sm text-gray-500 font-semibold">{receiptFile ? receiptFile.name : 'Click to select a file'}</p>
                    </div>
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*"
                      onChange={(e) => setReceiptFile(e.target.files ? e.target.files[0] : null)}
                    />
                  </label>
                </div>
              )}
            </div>

            {!uploadSuccess && (
              <div className="flex flex-col-reverse gap-2 border-t border-gray-100 bg-gray-50 px-5 py-4 sm:flex-row sm:justify-end sm:gap-3 sm:px-6">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="min-h-11 rounded-xl px-5 py-2.5 font-semibold text-gray-600 transition-colors hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleUploadReceipt}
                  disabled={!receiptFile || isUploading}
                  className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2.5 font-semibold text-white transition-colors ${
                    !receiptFile || isUploading ? 'bg-brown/50 cursor-not-allowed' : 'bg-brown hover:bg-brown-dark'
                  }`}
                >
                  {isUploading ? 'Uploading...' : 'Submit Receipt'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MyPayments;
