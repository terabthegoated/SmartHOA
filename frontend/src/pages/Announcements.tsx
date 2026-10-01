import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import axios from 'axios';
import { Bell, Plus, Calendar, Megaphone, X, Edit, Trash2 } from 'lucide-react';
import { API_BASE_URL } from '../config/api';

interface Announcement {
  announcement_id: string;
  title: string;
  content: string;
  publish_date: string;
  first_name: string;
  last_name: string;
}

const Announcements = () => {
  const { user, token } = useAuthStore();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal State for Officers
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const isOfficer = user?.role === 'Super Administrator' || user?.role === 'HOA Officer';

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/shared/get_announcements.php`, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      setAnnouncements(response.data);
    } catch (error) {
      console.error("Failed to fetch announcements", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchData();
  }, [token]);

  const openCreateModal = () => {
    setEditingId(null);
    setTitle('');
    setContent('');
    setIsModalOpen(true);
  };

  const openEditModal = (announcement: Announcement) => {
    setEditingId(announcement.announcement_id);
    setTitle(announcement.title);
    setContent(announcement.content);
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!title || !content) return;
    setIsSubmitting(true);

    try {
      if (editingId) {
        await axios.put(`${API_BASE_URL}/api/officer/update_announcement.php`, {
          announcement_id: editingId,
          title,
          content
        }, { headers: { Authorization: `Bearer ${token}` } });
      } else {
        await axios.post(`${API_BASE_URL}/api/officer/create_announcement.php`, {
          title,
          content
        }, { headers: { Authorization: `Bearer ${token}` } });
      }
      
      await fetchData();
      setIsModalOpen(false);
    } catch (error) {
      console.error("Failed to save announcement", error);
      alert("Failed to save announcement.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = (id: string) => {
    setDeletingId(id);
  };

  const executeDelete = async () => {
    if (!deletingId) return;

    try {
      await axios.delete(`${API_BASE_URL}/api/officer/delete_announcement.php`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { announcement_id: deletingId }
      });
      await fetchData();
      setDeletingId(null);
    } catch (error) {
      console.error("Failed to delete announcement", error);
      alert("Failed to delete announcement.");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative max-w-5xl mx-auto">
      <div className="flex justify-between items-end border-b border-gray-200 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-brown/10 text-brown rounded-xl">
            <Megaphone size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-heading font-bold text-gray-800">Community News</h1>
            <p className="text-gray-500 mt-1">Stay updated with the latest from the HOA.</p>
          </div>
        </div>
        
        {isOfficer && (
          <button 
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-brown hover:bg-brown-dark text-white font-semibold px-6 py-3 rounded-xl transition-colors shadow-sm"
          >
            <Plus size={18} />
            Publish Announcement
          </button>
        )}
      </div>

      <div className="space-y-6 pt-4">
        {isLoading ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm animate-pulse h-40"></div>
          ))
        ) : announcements.length === 0 ? (
          <div className="py-20 text-center text-gray-400 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <Bell size={48} className="mx-auto mb-4 opacity-20" />
            <p className="text-lg">No active announcements at this time.</p>
          </div>
        ) : (
          announcements.map((announcement) => (
            <div key={announcement.announcement_id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow relative group">
              {isOfficer && (
                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => openEditModal(announcement)}
                    className="p-2 bg-gray-100 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit size={16} />
                  </button>
                  <button 
                    onClick={() => confirmDelete(announcement.announcement_id)}
                    className="p-2 bg-gray-100 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
              
              <div className="p-6 md:p-8">
                <div className="flex justify-between items-start mb-4 pr-20">
                  <h2 className="text-2xl font-bold text-gray-800 font-heading">{announcement.title}</h2>
                </div>
                
                <div className="prose max-w-none text-gray-600 mb-6 whitespace-pre-wrap">
                  {announcement.content}
                </div>

                <div className="flex items-center justify-between text-sm text-gray-400 border-t border-gray-50 pt-4 mt-auto">
                  <span>Published by <strong>{announcement.first_name || 'Admin'} {announcement.last_name || ''}</strong></span>
                  <span className="flex items-center gap-1.5 font-semibold text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg shrink-0">
                    <Calendar size={14} />
                    {new Date(announcement.publish_date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create/Edit Announcement Modal */}
      {isOfficer && isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Megaphone size={18}/> 
                {editingId ? 'Edit Announcement' : 'Publish News'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Headline</label>
                <input 
                  type="text"
                  placeholder="E.g., Scheduled Water Interruption"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-brown focus:ring-1 focus:ring-brown bg-white"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Message Content</label>
                <textarea 
                  rows={6}
                  placeholder="Write the full announcement here..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-brown focus:ring-1 focus:ring-brown bg-white resize-none"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                ></textarea>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2.5 rounded-xl font-semibold text-gray-600 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSubmit}
                disabled={!title || !content || isSubmitting}
                className={`px-5 py-2.5 rounded-xl font-semibold text-white flex items-center gap-2 transition-colors ${
                  !title || !content || isSubmitting ? 'bg-brown/50 cursor-not-allowed' : 'bg-brown hover:bg-brown-dark'
                }`}
              >
                {isSubmitting ? 'Saving...' : (editingId ? 'Save Changes' : 'Publish Announcement')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {isOfficer && deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-2">
                <Trash2 size={32} />
              </div>
              <h3 className="font-bold text-gray-800 text-xl">Delete Announcement?</h3>
              <p className="text-sm text-gray-500">
                Are you sure you want to delete this announcement? This action cannot be undone.
              </p>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-100 flex justify-center gap-3 bg-gray-50">
              <button 
                onClick={() => setDeletingId(null)}
                className="px-5 py-2.5 rounded-xl font-semibold text-gray-600 hover:bg-gray-200 transition-colors flex-1"
              >
                Cancel
              </button>
              <button 
                onClick={executeDelete}
                className="px-5 py-2.5 rounded-xl font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors flex-1"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Announcements;
