import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import axios from 'axios';
import { Search, CheckCircle2, XCircle, Clock, AlertTriangle, FileImage, X, Download, BrainCircuit, ShieldAlert, SlidersHorizontal } from 'lucide-react';
import { API_BASE_URL } from '../../config/api';

type PriorityLevel = 'Low' | 'Medium' | 'High' | 'Critical';

interface Complaint {
  complaint_id: string;
  title: string;
  description: string;
  complaint_status: 'Submitted' | 'In Progress' | 'Resolved' | 'Closed';
  priority_level: PriorityLevel | null;
  priority_recommendation?: PriorityLevel | null;
  priority_reason?: string | null;
  priority_rule_code?: string | null;
  priority_overridden_by?: string | null;
  priority_overridden_at?: string | null;
  priority_override_reason?: string | null;
  priority_source?: 'DSS recommendation' | 'Officer override' | string | null;
  priority_is_overridden?: boolean;
  created_at: string;
  category_name: string;
  first_name: string;
  last_name: string;
  block: string;
  lot: string;
  file_url: string | null;
}

const priorityRank: Record<PriorityLevel, number> = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1,
};

const priorityBadgeClass: Record<PriorityLevel, string> = {
  Critical: 'bg-red-100 text-red-700',
  High: 'bg-orange-100 text-orange-700',
  Medium: 'bg-blue-100 text-blue-700',
  Low: 'bg-gray-100 text-gray-700',
};

const PriorityBadge = ({ priority }: { priority: PriorityLevel | null | undefined }) => {
  if (!priority) {
    return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase bg-gray-100 text-gray-500">Awaiting review</span>;
  }

  return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${priorityBadgeClass[priority]}`}>{priority}</span>;
};

const getCurrentPriority = (complaint: Complaint): PriorityLevel | null => complaint.priority_level || complaint.priority_recommendation || null;

const hasOfficerOverride = (complaint: Complaint) => Boolean(
  complaint.priority_overridden_at ||
  complaint.priority_overridden_by ||
  complaint.priority_is_overridden ||
  complaint.priority_source === 'Officer override' ||
  (complaint.priority_recommendation && complaint.priority_level && complaint.priority_recommendation !== complaint.priority_level)
);

const Complaints = () => {
  const { token } = useAuthStore();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'All' | PriorityLevel>('All');
  const [sortBy, setSortBy] = useState<'priority' | 'newest'>('priority');

  // View Modal State
  const [viewingComplaint, setViewingComplaint] = useState<Complaint | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedPriority, setSelectedPriority] = useState<PriorityLevel | ''>('');
  const [overrideReason, setOverrideReason] = useState('');
  const [isSavingPriority, setIsSavingPriority] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/officer/get_complaints.php`, { headers: { Authorization: `Bearer ${token}` } });
      const results = Array.isArray(response.data) ? response.data : [];
      setComplaints(results);
      return results as Complaint[];
    } catch (error) {
      console.error("Failed to fetch complaints", error);
      return [] as Complaint[];
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchData();
  }, [token]);

  const handleUpdateStatus = async (status: string) => {
    if (!viewingComplaint) return;
    setIsUpdating(true);

    try {
      await axios.post(`${API_BASE_URL}/api/officer/update_complaint.php`, {
        complaint_id: viewingComplaint.complaint_id,
        status: status
      }, { headers: { Authorization: `Bearer ${token}` } });
      
      await fetchData();
      setViewingComplaint(null);
    } catch (error) {
      console.error("Failed to update status", error);
      alert("Failed to update status. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  const openComplaintReview = (complaint: Complaint) => {
    setViewingComplaint(complaint);
    setSelectedPriority(getCurrentPriority(complaint) || '');
    setOverrideReason(complaint.priority_override_reason || '');
  };

  const handlePriorityUpdate = async () => {
    if (!viewingComplaint || !selectedPriority) return;

    const isChangingRecommendation = Boolean(
      viewingComplaint.priority_recommendation && selectedPriority !== viewingComplaint.priority_recommendation
    );

    if (isChangingRecommendation && !overrideReason.trim()) {
      alert('Please record why the HOA is changing the recommended priority.');
      return;
    }

    setIsSavingPriority(true);
    try {
      await axios.post(`${API_BASE_URL}/api/officer/update_complaint.php`, {
        complaint_id: viewingComplaint.complaint_id,
        priority_level: selectedPriority,
        priority_override_reason: overrideReason.trim() || null,
      }, { headers: { Authorization: `Bearer ${token}` } });

      const refreshedComplaints = await fetchData();
      const refreshedComplaint = refreshedComplaints.find((complaint) => complaint.complaint_id === viewingComplaint.complaint_id);
      if (refreshedComplaint) {
        setViewingComplaint(refreshedComplaint);
        setSelectedPriority(getCurrentPriority(refreshedComplaint) || '');
        setOverrideReason(refreshedComplaint.priority_override_reason || '');
      }
    } catch (error) {
      console.error('Failed to update priority', error);
      alert('The priority could not be saved. Please try again.');
    } finally {
      setIsSavingPriority(false);
    }
  };

  const filteredComplaints = complaints
    .filter(c => (
      c.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.category_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.last_name.toLowerCase().includes(searchTerm.toLowerCase())
    ))
    .filter((complaint) => priorityFilter === 'All' || getCurrentPriority(complaint) === priorityFilter)
    .sort((firstComplaint, secondComplaint) => {
      if (sortBy === 'priority') {
        const priorityDifference = (priorityRank[getCurrentPriority(secondComplaint) || 'Low'] || 0) - (priorityRank[getCurrentPriority(firstComplaint) || 'Low'] || 0);
        if (priorityDifference !== 0) return priorityDifference;
      }

      return new Date(secondComplaint.created_at).getTime() - new Date(firstComplaint.created_at).getTime();
    });

  const exportToCSV = () => {
    if (filteredComplaints.length === 0) return;
    
    const headers = ['ID', 'Category', 'Final Priority', 'DSS Recommendation', 'DSS Reason', 'Priority Source', 'Override Reason', 'Title', 'Description', 'Status', 'Resident', 'Block', 'Lot', 'Submitted Date'];
    const rows = filteredComplaints.map(c => [
      c.complaint_id,
      c.category_name,
      getCurrentPriority(c) || 'Awaiting review',
      c.priority_recommendation || 'Not available',
      `"${(c.priority_reason || '').replace(/"/g, '""')}"`,
      c.priority_source || (hasOfficerOverride(c) ? 'Officer override' : 'DSS recommendation'),
      `"${(c.priority_override_reason || '').replace(/"/g, '""')}"`,
      `"${c.title.replace(/"/g, '""')}"`,
      `"${c.description.replace(/"/g, '""')}"`,
      c.complaint_status,
      `"${c.first_name} ${c.last_name}"`,
      c.block || 'N/A',
      c.lot || 'N/A',
      new Date(c.created_at).toLocaleDateString()
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `SmartHOA_Complaints_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Submitted':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200"><Clock size={12} /> Pending Review</span>;
      case 'In Progress':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-orange-50 text-orange-700 border border-orange-200"><AlertTriangle size={12} /> In Progress</span>;
      case 'Resolved':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-green-50 text-green-700 border border-green-200"><CheckCircle2 size={12} /> Resolved</span>;
      case 'Closed':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-red-50 text-red-700 border border-red-200"><XCircle size={12} /> Closed</span>;
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      <div className="flex flex-col gap-4 xl:flex-row xl:justify-between xl:items-end">
        <div>
          <h1 className="text-2xl font-heading font-bold text-gray-800 sm:text-3xl">Complaint Queue</h1>
          <p className="text-gray-500 mt-2">Manage and resolve community issues.</p>
        </div>
        
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <div className="flex w-full items-center rounded-xl border border-gray-200 bg-white px-4 py-2 shadow-sm transition-all focus-within:border-brown focus-within:ring-1 focus-within:ring-brown sm:w-72">
            <Search className="w-5 h-5 text-gray-400 mr-3" />
            <input 
              type="text" 
              placeholder="Search reports..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent border-none outline-none w-full text-sm placeholder-gray-400"
            />
          </div>
          <div className="flex min-h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm sm:w-auto">
            <SlidersHorizontal size={16} className="text-gray-400" />
            <label htmlFor="priority-filter" className="sr-only">Filter by priority</label>
            <select
              id="priority-filter"
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value as 'All' | PriorityLevel)}
              className="bg-transparent text-sm font-medium text-gray-700 outline-none"
            >
              <option value="All">All priorities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
          <div className="flex min-h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm sm:w-auto">
            <label htmlFor="complaint-sort" className="sr-only">Sort complaints</label>
            <select
              id="complaint-sort"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as 'priority' | 'newest')}
              className="bg-transparent text-sm font-medium text-gray-700 outline-none"
            >
              <option value="priority">Priority: highest first</option>
              <option value="newest">Newest first</option>
            </select>
          </div>
          <button 
            onClick={exportToCSV}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 sm:w-auto"
          >
            <Download size={18} />
            Export CSV
          </button>
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {isLoading ? (
          [...Array(3)].map((_, index) => (
            <div key={index} className="h-60 animate-pulse rounded-2xl border border-gray-100 bg-white p-5 shadow-sm" />
          ))
        ) : filteredComplaints.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-white px-5 py-12 text-center text-gray-400 shadow-sm">
            No complaints found.
          </div>
        ) : (
          filteredComplaints.map((complaint) => (
            <article key={complaint.complaint_id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-400">{complaint.category_name}</span>
                    <PriorityBadge priority={getCurrentPriority(complaint)} />
                  </div>
                  <h2 className="mt-2 font-bold text-gray-800">{complaint.title}</h2>
                </div>
                {getStatusBadge(complaint.complaint_status)}
              </div>

              <div className="mt-4 space-y-3 border-y border-gray-100 py-4 text-sm">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Resident</p>
                  <p className="mt-1 font-semibold text-gray-700">{complaint.first_name} {complaint.last_name}</p>
                  <p className="text-gray-500">{complaint.block && complaint.lot ? `Blk ${complaint.block}, Lot ${complaint.lot}` : 'Property unassigned'}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <PriorityBadge priority={complaint.priority_recommendation} />
                  <span className="text-xs text-gray-500">DSS recommendation</span>
                  {hasOfficerOverride(complaint) && <span className="inline-flex items-center gap-1 text-xs font-medium text-brown"><ShieldAlert size={13} /> Officer override</span>}
                </div>
                <div className="flex items-center justify-between gap-3 text-xs text-gray-500">
                  <span>{new Date(complaint.created_at).toLocaleDateString()}</span>
                  {complaint.file_url && <span className="inline-flex items-center gap-1 text-brown"><FileImage size={13} /> Attachment</span>}
                </div>
              </div>

              <button
                type="button"
                onClick={() => openComplaintReview(complaint)}
                className="mt-4 min-h-11 w-full rounded-xl bg-brown/10 px-4 py-2.5 text-sm font-semibold text-brown transition-colors hover:bg-brown/20"
              >
                Review complaint
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
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Report Info</th>
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Resident</th>
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Decision Support</th>
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-gray-400">Loading complaints...</td>
                </tr>
              ) : filteredComplaints.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-gray-400">No complaints found.</td>
                </tr>
              ) : (
                filteredComplaints.map((complaint) => (
                  <tr key={complaint.complaint_id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{complaint.category_name}</span>
                          <PriorityBadge priority={getCurrentPriority(complaint)} />
                        </div>
                        <span className="font-bold text-gray-800 line-clamp-1">{complaint.title}</span>
                        {complaint.file_url && <span className="text-xs text-brown flex items-center gap-1 mt-1"><FileImage size={12} /> Attachment included</span>}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <p className="font-semibold text-gray-800">{complaint.first_name} {complaint.last_name}</p>
                      <p className="text-xs text-gray-500">
                        {complaint.block && complaint.lot ? `Blk ${complaint.block}, Lot ${complaint.lot}` : 'Unassigned'}
                      </p>
                    </td>
                    <td className="py-4 px-6">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <PriorityBadge priority={complaint.priority_recommendation} />
                          <span className="text-xs font-semibold text-gray-700">DSS recommendation</span>
                        </div>
                        {hasOfficerOverride(complaint) ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-brown"><ShieldAlert size={13} /> Officer override</span>
                        ) : complaint.priority_recommendation ? (
                          <span className="text-xs text-gray-500">Using recommendation</span>
                        ) : (
                          <span className="text-xs text-gray-400">Assessment unavailable</span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      {getStatusBadge(complaint.complaint_status)}
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-600">
                      {new Date(complaint.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button 
                        onClick={() => openComplaintReview(complaint)}
                        className="text-sm font-semibold text-brown hover:text-brown-dark bg-brown/10 hover:bg-brown/20 px-4 py-2 rounded-xl transition-colors"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review Modal */}
      {viewingComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                Review Complaint
              </h3>
              <button onClick={() => setViewingComplaint(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{viewingComplaint.category_name}</span>
                    <PriorityBadge priority={getCurrentPriority(viewingComplaint)} />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-800">{viewingComplaint.title}</h2>
                </div>
                {getStatusBadge(viewingComplaint.complaint_status)}
              </div>

              <div className="bg-cream p-4 rounded-xl border border-brown/10 flex items-center gap-4">
                <div className="w-12 h-12 bg-brown/10 rounded-full flex items-center justify-center text-brown font-bold text-lg">
                  {viewingComplaint.first_name[0]}{viewingComplaint.last_name[0]}
                </div>
                <div>
                  <p className="font-bold text-gray-800">{viewingComplaint.first_name} {viewingComplaint.last_name}</p>
                  <p className="text-sm text-gray-500">
                    {viewingComplaint.block && viewingComplaint.lot ? `Block ${viewingComplaint.block}, Lot ${viewingComplaint.lot}` : 'No property assigned'}
                  </p>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-gray-800 mb-2">Description</h4>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-sm text-gray-700 whitespace-pre-wrap">
                  {viewingComplaint.description}
                </div>
              </div>

              <section className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4" aria-labelledby="decision-support-heading">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                      <BrainCircuit size={19} />
                    </div>
                    <div>
                      <h4 id="decision-support-heading" className="font-bold text-gray-800">Decision Support Assessment</h4>
                      <p className="mt-1 text-sm text-gray-600">The rule-based recommendation helps officers prioritize the queue. Officers retain the final decision.</p>
                    </div>
                  </div>
                  {hasOfficerOverride(viewingComplaint) && (
                    <span className="inline-flex shrink-0 items-center gap-1 self-start rounded-full bg-brown/10 px-2.5 py-1 text-xs font-semibold text-brown"><ShieldAlert size={13} /> Officer override</span>
                  )}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-indigo-100 bg-white p-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-400">DSS recommended priority</p>
                    <div className="mt-2"><PriorityBadge priority={viewingComplaint.priority_recommendation} /></div>
                  </div>
                  <div className="rounded-lg border border-indigo-100 bg-white p-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Current handling priority</p>
                    <div className="mt-2"><PriorityBadge priority={getCurrentPriority(viewingComplaint)} /></div>
                  </div>
                </div>

                {viewingComplaint.priority_reason ? (
                  <div className="mt-3 rounded-lg border border-indigo-100 bg-white p-3 text-sm text-gray-700">
                    <p className="mb-1 text-xs font-bold uppercase tracking-wider text-gray-400">Why the system recommended this</p>
                    <p>{viewingComplaint.priority_reason}</p>
                    {viewingComplaint.priority_rule_code && <p className="mt-2 text-xs text-gray-400">Rule: {viewingComplaint.priority_rule_code}</p>}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-gray-500">No rule explanation is available for this legacy report yet.</p>
                )}

                <div className="mt-4 border-t border-indigo-100 pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h5 className="font-semibold text-gray-800">Officer priority decision</h5>
                      <p className="text-xs text-gray-500">Changing the system recommendation requires a reason for the audit trail.</p>
                    </div>
                    {viewingComplaint.priority_recommendation && selectedPriority !== viewingComplaint.priority_recommendation && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPriority(viewingComplaint.priority_recommendation || '');
                          setOverrideReason('');
                        }}
                        className="shrink-0 text-xs font-semibold text-brown hover:text-brown-dark"
                      >
                        Use recommendation
                      </button>
                    )}
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor="officer-priority" className="mb-1.5 block text-sm font-semibold text-gray-700">Final priority</label>
                      <select
                        id="officer-priority"
                        value={selectedPriority}
                        onChange={(event) => {
                          const nextPriority = event.target.value as PriorityLevel;
                          setSelectedPriority(nextPriority);
                          if (nextPriority === viewingComplaint.priority_recommendation) setOverrideReason('');
                        }}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-brown focus:ring-1 focus:ring-brown"
                      >
                        <option value="" disabled>Select a priority</option>
                        <option value="Critical">Critical</option>
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="priority-override-reason" className="mb-1.5 block text-sm font-semibold text-gray-700">Override reason {viewingComplaint.priority_recommendation && selectedPriority !== viewingComplaint.priority_recommendation ? '(required)' : '(optional)'}</label>
                      <input
                        id="priority-override-reason"
                        type="text"
                        value={overrideReason}
                        onChange={(event) => setOverrideReason(event.target.value)}
                        placeholder="Explain the officer decision"
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-brown focus:ring-1 focus:ring-brown"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handlePriorityUpdate}
                    disabled={!selectedPriority || isSavingPriority}
                    className={`mt-3 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors ${!selectedPriority || isSavingPriority ? 'cursor-not-allowed bg-brown/50' : 'bg-brown hover:bg-brown-dark'}`}
                  >
                    {isSavingPriority ? 'Saving priority...' : 'Save priority decision'}
                  </button>
                </div>
              </section>

              {viewingComplaint.file_url && (
                <div>
                  <h4 className="font-bold text-gray-800 mb-2 flex items-center gap-2"><FileImage size={16} /> Attached Evidence</h4>
                  <div className="bg-gray-100 rounded-xl overflow-hidden border border-gray-200 max-h-80 flex justify-center items-center">
                    <img 
                      src={`${API_BASE_URL}${viewingComplaint.file_url}`} 
                      alt="Evidence" 
                      className="max-h-80 max-w-full object-contain"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 shrink-0">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Update Status</h4>
              <div className="flex flex-wrap gap-3">
                <button 
                  onClick={() => handleUpdateStatus('In Progress')}
                  disabled={isUpdating || viewingComplaint.complaint_status === 'In Progress'}
                  className={`flex-1 py-2.5 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 ${
                    viewingComplaint.complaint_status === 'In Progress' ? 'bg-orange-100 text-orange-700 cursor-default' : 'bg-white border border-gray-200 text-gray-700 hover:bg-orange-50 hover:border-orange-200 hover:text-orange-700'
                  }`}
                >
                  <AlertTriangle size={16} /> Mark In Progress
                </button>
                <button 
                  onClick={() => handleUpdateStatus('Resolved')}
                  disabled={isUpdating || viewingComplaint.complaint_status === 'Resolved'}
                  className={`flex-1 py-2.5 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 ${
                    viewingComplaint.complaint_status === 'Resolved' ? 'bg-green-100 text-green-700 cursor-default' : 'bg-white border border-gray-200 text-gray-700 hover:bg-green-50 hover:border-green-200 hover:text-green-700'
                  }`}
                >
                  <CheckCircle2 size={16} /> Mark Resolved
                </button>
                <button 
                  onClick={() => handleUpdateStatus('Closed')}
                  disabled={isUpdating || viewingComplaint.complaint_status === 'Closed'}
                  className={`flex-1 py-2.5 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 ${
                    viewingComplaint.complaint_status === 'Closed' ? 'bg-red-100 text-red-700 cursor-default' : 'bg-white border border-gray-200 text-gray-700 hover:bg-red-50 hover:border-red-200 hover:text-red-700'
                  }`}
                >
                  <XCircle size={16} /> Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Complaints;
