import { useEffect, useState } from 'react';
import { ArrowRight, Bell, BellRing, CheckCircle2, Clock3, CreditCard, FileText } from 'lucide-react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { API_BASE_URL } from '../../config/api';

interface DuesSummary {
  status: 'Paid' | 'Due' | 'Overdue' | 'Awaiting bill' | 'Not applicable';
  amount_due: number;
  base_dues: number;
  penalty_amount: number;
  billing_label: string;
  due_date: string | null;
  months_overdue: number;
  collection_stage: string;
  message: string;
}

interface Announcement {
  announcement_id: string;
  title: string;
  content: string;
  publish_date: string;
  created_at?: string;
}

interface ComplaintSummary {
  active_count: number;
}

const formatAnnouncementDate = (announcement: Announcement) => {
  const date = new Date(announcement.publish_date || announcement.created_at || '');
  if (Number.isNaN(date.getTime())) return 'Recently published';

  return `Published ${date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`;
};

const formatDueDate = (dueDate: string | null) => {
  if (!dueDate) return 'the listed due date';

  const date = new Date(`${dueDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dueDate;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const ResidentDashboard = () => {
  const { user, token } = useAuthStore();
  const [dues, setDues] = useState<DuesSummary>({
    status: 'Not applicable',
    amount_due: 0,
    base_dues: 0,
    penalty_amount: 0,
    billing_label: '',
    due_date: null,
    months_overdue: 0,
    collection_stage: '',
    message: 'Checking your current dues.',
  });
  const [isLoadingDues, setIsLoadingDues] = useState(true);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoadingAnnouncements, setIsLoadingAnnouncements] = useState(true);
  const [announcementsUnavailable, setAnnouncementsUnavailable] = useState(false);
  const [activeComplaintCount, setActiveComplaintCount] = useState(0);
  const [isLoadingComplaints, setIsLoadingComplaints] = useState(true);

  useEffect(() => {
    let isCurrent = true;

    const fetchDues = async () => {
      if (!token) return;

      try {
        const response = await axios.get<DuesSummary>(`${API_BASE_URL}/api/resident/get_dues_to_pay.php`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (isCurrent) setDues(response.data);
      } catch (error) {
        console.error('Unable to load current dues.', error);
        if (isCurrent) {
          setDues((current) => ({
            ...current,
            message: 'Current dues are unavailable right now. Please try again later.',
          }));
        }
      } finally {
        if (isCurrent) setIsLoadingDues(false);
      }
    };

    void fetchDues();
    return () => { isCurrent = false; };
  }, [token]);

  useEffect(() => {
    let isCurrent = true;

    const fetchComplaintSummary = async () => {
      if (!token) {
        if (isCurrent) setIsLoadingComplaints(false);
        return;
      }

      try {
        const response = await axios.get<ComplaintSummary>(`${API_BASE_URL}/api/resident/get_complaint_summary.php`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (isCurrent) {
          setActiveComplaintCount(Number(response.data?.active_count || 0));
        }
      } catch (error) {
        console.error('Unable to load active complaint count.', error);
      } finally {
        if (isCurrent) setIsLoadingComplaints(false);
      }
    };

    void fetchComplaintSummary();
    return () => { isCurrent = false; };
  }, [token]);

  useEffect(() => {
    let isCurrent = true;

    const fetchRecentAnnouncements = async () => {
      if (!token) {
        if (isCurrent) setIsLoadingAnnouncements(false);
        return;
      }

      try {
        const response = await axios.get<Announcement[]>(`${API_BASE_URL}/api/shared/get_announcements.php`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (isCurrent) {
          setAnnouncements(Array.isArray(response.data) ? response.data.slice(0, 3) : []);
          setAnnouncementsUnavailable(false);
        }
      } catch (error) {
        console.error('Unable to load recent announcements.', error);
        if (isCurrent) {
          setAnnouncements([]);
          setAnnouncementsUnavailable(true);
        }
      } finally {
        if (isCurrent) setIsLoadingAnnouncements(false);
      }
    };

    void fetchRecentAnnouncements();
    return () => { isCurrent = false; };
  }, [token]);

  const isOverdue = dues.status === 'Overdue';
  const isPaid = dues.status === 'Paid';
  const hasPendingDues = !isLoadingDues && (dues.status === 'Due' || isOverdue) && Number(dues.amount_due) > 0;
  const displayedAmount = dues.status === 'Awaiting bill' || dues.status === 'Not applicable'
    ? '—'
    : `₱${Number(dues.amount_due || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  const duesIconClass = isOverdue
    ? 'bg-red-50 text-red-600'
    : isPaid
      ? 'bg-green-50 text-green-600'
      : 'bg-brown/10 text-brown';

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-heading font-bold text-gray-800">Welcome Home, {user?.name || 'Resident'}! 👋</h1>
        <p className="text-gray-500 mt-2">Here is a summary of your account and community updates.</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-start gap-4">
          <div className={`p-4 rounded-xl ${duesIconClass}`}>
            {isPaid ? <CheckCircle2 size={24} /> : isOverdue ? <Clock3 size={24} /> : <CreditCard size={24} />}
          </div>
          <div className="min-w-0">
            <p className="text-sm text-gray-500 font-semibold mb-1">Dues to be Paid</p>
            <h3 className={`text-2xl font-bold ${isOverdue ? 'text-red-600' : 'text-gray-800'}`}>
              {isLoadingDues ? 'Checking...' : displayedAmount}
            </h3>
            <p className={`mt-1 text-xs leading-5 ${isOverdue ? 'text-red-600' : 'text-gray-500'}`}>
              {dues.billing_label && <span className="font-semibold">{dues.billing_label}: </span>}
              {dues.message}
            </p>
            {!isLoadingDues && dues.collection_stage && !isPaid && (
              <p className={`mt-2 text-xs font-bold ${isOverdue ? 'text-red-700' : 'text-brown'}`}>
                {dues.collection_stage}
              </p>
            )}
          </div>
        </div>

        <Link to="/my-complaints" className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 transition-colors hover:bg-orange-50/30">
          <div className="p-4 bg-orange-50 text-orange-600 rounded-xl">
            <FileText size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-semibold mb-1">Active Complaints</p>
            <h3 className="text-2xl font-bold text-gray-800">{isLoadingComplaints ? '...' : activeComplaintCount}</h3>
          </div>
        </Link>
      </div>

      {/* Recent Announcements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 rounded-xl bg-brown/10 text-brown shrink-0">
                <BellRing size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-800">Payment Reminders</h2>
                <p className="text-xs text-gray-500 mt-0.5">Your live account status</p>
              </div>
            </div>
            <Link to="/my-payments" className="text-sm font-semibold text-brown hover:text-brown-dark transition-colors shrink-0">
              My bills
            </Link>
          </div>

          <div className="p-6">
            {isLoadingDues ? (
              <div className="space-y-3 animate-pulse">
                <div className="h-4 w-1/3 rounded bg-gray-100" />
                <div className="h-3 w-full rounded bg-gray-100" />
                <div className="h-3 w-2/3 rounded bg-gray-100" />
              </div>
            ) : hasPendingDues ? (
              <Link
                to="/my-payments"
                className={`block rounded-xl border p-4 transition-colors ${
                  isOverdue
                    ? 'border-red-200 bg-red-50 hover:bg-red-100/70'
                    : 'border-brown/20 bg-cream hover:bg-brown/10'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 p-2 rounded-lg shrink-0 ${isOverdue ? 'bg-red-100 text-red-600' : 'bg-white text-brown'}`}>
                    {isOverdue ? <Clock3 size={18} /> : <BellRing size={18} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`font-bold ${isOverdue ? 'text-red-800' : 'text-gray-800'}`}>
                      {isOverdue ? 'Payment overdue' : 'New or pending bill'}
                    </p>
                    <p className={`text-sm leading-5 mt-1 ${isOverdue ? 'text-red-700' : 'text-gray-600'}`}>
                      {dues.billing_label ? `${dues.billing_label}: ` : ''}
                      {displayedAmount} is due {isOverdue ? 'now' : `by ${formatDueDate(dues.due_date)}`}.
                    </p>
                    <p className={`text-xs leading-5 mt-2 ${isOverdue ? 'text-red-700' : 'text-gray-500'}`}>
                      {dues.message}
                    </p>
                    <span className={`mt-3 inline-flex items-center gap-1 text-sm font-bold ${isOverdue ? 'text-red-700' : 'text-brown'}`}>
                      Review and pay bill <ArrowRight size={16} />
                    </span>
                  </div>
                </div>
              </Link>
            ) : (
              <div className="py-4 text-center text-gray-500">
                <CheckCircle2 size={30} className="mx-auto mb-2 text-green-500" />
                <p className="text-sm font-semibold text-gray-700">
                  {isPaid ? 'No payment is due right now.' : 'No pending payment reminders.'}
                </p>
                <p className="text-xs mt-1">{dues.message}</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-gray-800">Recent Announcements</h2>
            <Link to="/announcements" className="text-sm font-semibold text-brown hover:text-brown-dark transition-colors shrink-0">
              View all
            </Link>
          </div>
          <div className="p-6">
            {isLoadingAnnouncements ? (
              <div className="space-y-4 animate-pulse">
                <div className="h-4 w-2/3 rounded bg-gray-100" />
                <div className="h-3 w-full rounded bg-gray-100" />
                <div className="h-3 w-1/3 rounded bg-gray-100" />
              </div>
            ) : announcementsUnavailable ? (
              <p className="text-sm text-gray-500">Announcements are unavailable right now. Please try again later.</p>
            ) : announcements.length === 0 ? (
              <div className="py-3 text-center text-gray-500">
                <Bell size={28} className="mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No active announcements at this time.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {announcements.map((announcement) => (
                  <Link
                    key={announcement.announcement_id}
                    to="/announcements"
                    className="flex gap-4 rounded-xl p-2 -m-2 hover:bg-cream/70 transition-colors"
                  >
                    <div className="w-2 h-2 mt-2 rounded-full bg-brown shrink-0" />
                    <div className="min-w-0">
                      <h4 className="font-semibold text-gray-800 line-clamp-1">{announcement.title}</h4>
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{announcement.content}</p>
                      <span className="text-xs text-gray-400 mt-2 block">{formatAnnouncementDate(announcement)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResidentDashboard;
