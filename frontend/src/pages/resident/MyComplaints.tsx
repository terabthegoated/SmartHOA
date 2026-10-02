import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import axios from 'axios';
import { Search, Plus, MessageSquare, Clock, CheckCircle2, XCircle, FileImage, X, AlertTriangle, Star, BrainCircuit, ShieldAlert } from 'lucide-react';
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
  priority_overridden_at?: string | null;
  priority_is_overridden?: boolean;
  created_at: string;
  category_name: string;
  file_url: string | null;
  feedback_rating: number | null;
  feedback_comment: string | null;
}

const priorityBadgeClass: Record<PriorityLevel, string> = {
  Critical: 'bg-red-100 text-red-700',
  High: 'bg-orange-100 text-orange-700',
  Medium: 'bg-blue-100 text-blue-700',
  Low: 'bg-gray-100 text-gray-700',
};

const PriorityBadge = ({ priority }: { priority: PriorityLevel | null | undefined }) => {
  if (!priority) return null;

  return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${priorityBadgeClass[priority]}`}>{priority}</span>;
};

const getCurrentPriority = (complaint: Complaint): PriorityLevel | null => complaint.priority_level || complaint.priority_recommendation || null;

const hasOfficerReview = (complaint: Complaint) => Boolean(
  complaint.priority_is_overridden ||
  complaint.priority_overridden_at ||
  (complaint.priority_recommendation && complaint.priority_level && complaint.priority_recommendation !== complaint.priority_level)
);

interface Category {
  category_id: string;
  category_name: string;
}

const MyComplaints = () => {
  const { token } = useAuthStore();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Submit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);

  // View Details Modal State
  const [viewingComplaint, setViewingComplaint] = useState<Complaint | null>(null);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [isSavingFeedback, setIsSavingFeedback] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [complaintsRes, categoriesRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/resident/get_my_complaints.php`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_BASE_URL}/api/shared/get_complaint_categories.php`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setComplaints(complaintsRes.data);
      setCategories(categoriesRes.data);
    } catch (error) {
      console.error("Failed to fetch complaints", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchData();
  }, [token]);

  const handleSubmit = async () => {
    if (!title || !description || !categoryId) return;
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('category_id', categoryId);
      if (attachment) {
        formData.append('attachment', attachment);
      }

      await axios.post(`${API_BASE_URL}/api/resident/submit_complaint.php`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      await fetchData();
      setIsModalOpen(false);
      
      // Reset form
      setTitle('');
      setDescription('');
      setCategoryId('');
      setAttachment(null);
    } catch (error) {
      console.error("Failed to submit complaint", error);
      alert("Failed to submit complaint. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openComplaintDetails = (complaint: Complaint) => {
    setViewingComplaint(complaint);
    setFeedbackRating(complaint.feedback_rating ? Number(complaint.feedback_rating) : 0);
    setFeedbackComment(complaint.feedback_comment || '');
  };

  const handleFeedbackSubmit = async () => {
    if (!viewingComplaint || feedbackRating < 1) return;
    setIsSavingFeedback(true);
    try {
      await axios.post(`${API_BASE_URL}/api/resident/submit_feedback.php`, {
        complaint_id: viewingComplaint.complaint_id,
        rating: feedbackRating,
        comment: feedbackComment
      }, { headers: { Authorization: `Bearer ${token}` } });
      setViewingComplaint({ ...viewingComplaint, feedback_rating: feedbackRating, feedback_comment: feedbackComment });
      await fetchData();
    } catch (error) {
      console.error('Failed to submit feedback', error);
      alert('Your feedback could not be saved. Please try again.');
    } finally {
      setIsSavingFeedback(false);
    }
  };

  const filteredComplaints = complaints.filter(c => 
    c.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.category_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-gray-800 sm:text-3xl">My Complaints</h1>
          <p className="text-gray-500 mt-2">Submit issues and track their resolution status.</p>
        </div>
        
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brown px-5 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-brown-dark sm:w-auto"
          >
            <Plus size={18} />
            File a Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm animate-pulse h-48"></div>
          ))
        ) : filteredComplaints.length === 0 ? (
          <div className="col-span-full py-16 text-center text-gray-400 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <MessageSquare size={48} className="mx-auto mb-4 opacity-20" />
            <p className="text-lg">No complaints filed yet.</p>
          </div>
        ) : (
          filteredComplaints.map(complaint => (
            <div 
              key={complaint.complaint_id} 
              onClick={() => openComplaintDetails(complaint)}
              className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
            >
              <div>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{complaint.category_name}</span>
                    <PriorityBadge priority={getCurrentPriority(complaint)} />
                  </div>
                  {getStatusBadge(complaint.complaint_status)}
                </div>
                <h3 className="font-bold text-gray-800 text-lg mb-2 line-clamp-1 group-hover:text-brown transition-colors">{complaint.title}</h3>
                <p className="text-gray-500 text-sm line-clamp-2">{complaint.description}</p>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-50 flex justify-between items-center text-xs text-gray-400 font-medium">
                <span>{new Date(complaint.created_at).toLocaleDateString()}</span>
                {complaint.file_url && <span className="flex items-center gap-1 text-brown"><FileImage size={14} /> Has Image</span>}
              </div>
            </div>
          ))
        )}
      </div>

      {/* New Complaint Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 pb-14 backdrop-blur-sm animate-in fade-in duration-200 sm:p-4">
          <div className="flex max-h-[calc(100dvh-4rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl animate-in zoom-in-95 duration-200 sm:max-h-[90vh]">
            <div className="flex shrink-0 items-center justify-between border-b border-gray-100 bg-gray-50 px-5 py-4 sm:px-6">
              <h3 className="font-bold text-gray-800">Submit a Complaint</h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-white hover:text-gray-600" aria-label="Close complaint form">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 space-y-4 overflow-y-auto p-5 sm:p-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Category</label>
                <select 
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-brown focus:ring-1 focus:ring-brown bg-white"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="" disabled>Select the type of issue...</option>
                  {categories.map(c => (
                    <option key={c.category_id} value={c.category_id}>{c.category_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Title</label>
                <input 
                  type="text"
                  placeholder="E.g., Broken streetlight at Block 2"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-brown focus:ring-1 focus:ring-brown bg-white"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                <textarea 
                  rows={4}
                  placeholder="Please provide details about the issue..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-brown focus:ring-1 focus:ring-brown bg-white resize-none"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                ></textarea>
                <p className="mt-2 text-xs text-gray-500">SmartHOA will recommend a priority from your selected category and report details. An HOA officer will review it.</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Attach Evidence (Optional)</label>
                <label className="group flex h-28 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-white transition-colors hover:bg-gray-50">
                  <div className="flex flex-col items-center justify-center">
                    <FileImage className="w-6 h-6 text-gray-400 group-hover:text-brown mb-1 transition-colors" />
                    <p className="text-xs text-gray-500 font-semibold">{attachment ? attachment.name : 'Upload an image'}</p>
                  </div>
                  <input 
                    type="file" 
                    className="hidden" 
                    accept="image/*"
                    onChange={(e) => setAttachment(e.target.files ? e.target.files[0] : null)}
                  />
                </label>
              </div>
            </div>

            <div className="grid shrink-0 grid-cols-2 gap-3 border-t border-gray-100 bg-gray-50 px-5 py-4 sm:px-6">
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="min-h-11 rounded-xl px-4 py-2.5 font-semibold text-gray-600 transition-colors hover:bg-gray-200"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={handleSubmit}
                disabled={!title || !description || !categoryId || isSubmitting}
                className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-semibold text-white transition-colors ${
                  !title || !description || !categoryId || isSubmitting ? 'bg-brown/50 cursor-not-allowed' : 'bg-brown hover:bg-brown-dark'
                }`}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Complaint Modal */}
      {viewingComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 pb-14 backdrop-blur-sm animate-in fade-in duration-200 sm:p-4">
          <div className="flex max-h-[calc(100dvh-4rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl animate-in zoom-in-95 duration-200 sm:max-h-[90vh]">
            <div className="flex shrink-0 items-center justify-between border-b border-gray-100 bg-gray-50 px-5 py-4 sm:px-6">
              <h3 className="font-bold text-gray-800">Complaint Details</h3>
              <button type="button" onClick={() => setViewingComplaint(null)} className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-white hover:text-gray-600" aria-label="Close complaint details">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 space-y-6 overflow-y-auto p-5 sm:p-6">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{viewingComplaint.category_name}</span>
                    <PriorityBadge priority={getCurrentPriority(viewingComplaint)} />
                  </div>
                  {getStatusBadge(viewingComplaint.complaint_status)}
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">{viewingComplaint.title}</h2>
                <p className="text-sm text-gray-500">Submitted on {new Date(viewingComplaint.created_at).toLocaleString()}</p>
              </div>

              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-sm text-gray-700 whitespace-pre-wrap">
                {viewingComplaint.description}
              </div>

              {getCurrentPriority(viewingComplaint) && (
                <section className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4" aria-labelledby="priority-assessment-heading">
                  <div className="flex gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                      <BrainCircuit size={19} />
                    </div>
                    <div>
                      <h3 id="priority-assessment-heading" className="font-bold text-gray-800">Priority assessment</h3>
                      <p className="mt-1 text-sm text-gray-600">The HOA is handling this report as <span className="font-semibold text-gray-800">{getCurrentPriority(viewingComplaint)}</span> priority.</p>
                    </div>
                  </div>

                  {viewingComplaint.priority_reason && (
                    <div className="mt-3 rounded-lg border border-indigo-100 bg-white p-3 text-sm text-gray-700">
                      <p className="mb-1 text-xs font-bold uppercase tracking-wider text-gray-400">Why this priority was recommended</p>
                      <p>{viewingComplaint.priority_reason}</p>
                    </div>
                  )}

                  {hasOfficerReview(viewingComplaint) && (
                    <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-brown"><ShieldAlert size={14} /> This priority was reviewed by an HOA officer based on the report details.</p>
                  )}
                </section>
              )}

              {(viewingComplaint.complaint_status === 'Resolved' || viewingComplaint.complaint_status === 'Closed') && (
                <div className="rounded-xl border border-gold/30 bg-gold/5 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="font-bold text-gray-800">How was the resolution?</h3>
                      <p className="text-sm text-gray-500">Your rating is used only in aggregated community satisfaction analytics.</p>
                    </div>
                    {viewingComplaint.feedback_rating && <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-1 rounded-full">Feedback saved</span>}
                  </div>
                  <div className="flex gap-1 mt-3" aria-label="Rate this resolved complaint from one to five stars">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button key={rating} type="button" onClick={() => setFeedbackRating(rating)} className="p-1 text-gold hover:scale-110 transition-transform" aria-label={`${rating} star${rating > 1 ? 's' : ''}`}>
                        <Star size={25} fill={rating <= feedbackRating ? 'currentColor' : 'none'} />
                      </button>
                    ))}
                  </div>
                  <textarea value={feedbackComment} onChange={(event) => setFeedbackComment(event.target.value)} rows={2} placeholder="Optional comment about the resolution" className="mt-3 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-brown focus:outline-none focus:ring-1 focus:ring-brown" />
                  <button type="button" onClick={handleFeedbackSubmit} disabled={feedbackRating < 1 || isSavingFeedback} className={`mt-3 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors ${feedbackRating < 1 || isSavingFeedback ? 'bg-brown/50 cursor-not-allowed' : 'bg-brown hover:bg-brown-dark'}`}>
                    {isSavingFeedback ? 'Saving...' : viewingComplaint.feedback_rating ? 'Update Feedback' : 'Submit Feedback'}
                  </button>
                </div>
              )}

              {viewingComplaint.file_url && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">Attached Image</p>
                  <div className="bg-gray-100 rounded-xl overflow-hidden border border-gray-200">
                    <img 
                      src={`${API_BASE_URL}${viewingComplaint.file_url}`} 
                      alt="Attachment" 
                      className="w-full h-auto"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyComplaints;
