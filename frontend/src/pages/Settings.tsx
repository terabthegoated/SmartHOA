import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { User, Mail, Phone, Home, Save } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';

const Settings = () => {
  const { user, token } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    contactNumber: '',
    email: user?.email || '',
    block: '',
    lot: '',
  });

  // Fetch full profile data on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/auth/me.php`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.data) {
          setFormData({
            firstName: response.data.first_name || '',
            lastName: response.data.last_name || '',
            contactNumber: response.data.contact_number || '',
            email: response.data.email || '',
            block: response.data.block || '',
            lot: response.data.lot || '',
          });
        }
      } catch (error) {
        console.error("Failed to load profile", error);
      }
    };

    if (token) {
      fetchProfile();
    }
  }, [token]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setSuccessMsg('');

    try {
      await axios.put(`${API_BASE_URL}/api/auth/update_profile.php`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccessMsg('Profile updated successfully!');

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (error) {
      console.error("Failed to update profile", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-heading font-bold text-gray-800">Account Settings</h1>
        <p className="text-gray-500 mt-2">Manage your personal information and preferences.</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-cream rounded-full flex items-center justify-center text-brown font-bold text-xl border-2 border-brown/20">
              {formData.firstName ? formData.firstName.charAt(0) : <User size={28} />}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">{formData.firstName} {formData.lastName}</h2>
              <div className="flex items-center gap-2 text-sm text-brown font-semibold mt-1">
                <User size={14} />
                <span>{user?.role}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">

            {successMsg && (
              <div className="p-4 bg-green-50 text-green-700 border border-green-200 rounded-xl text-sm font-semibold flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                {successMsg}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">First Name</label>
                <div className="relative">
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all"
                  />
                  <User className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Last Name</label>
                <div className="relative">
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all"
                  />
                  <User className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Email Address (Read-Only)</label>
                <div className="relative">
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    disabled
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-500 outline-none"
                  />
                  <Mail className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Contact Number</label>
                <div className="relative">
                  <input
                    type="tel"
                    name="contactNumber"
                    value={formData.contactNumber}
                    onChange={handleChange}
                    placeholder="+63 912 345 6789"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all"
                  />
                  <Phone className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Block</label>
                <div className="relative">
                  <input
                    type="text"
                    name="block"
                    value={formData.block}
                    onChange={handleChange}
                    placeholder="e.g. 1A"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all"
                  />
                  <Home className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Lot</label>
                <div className="relative">
                  <input
                    type="text"
                    name="lot"
                    value={formData.lot}
                    onChange={handleChange}
                    placeholder="e.g. 15"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all"
                  />
                  <Home className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-gray-100 flex justify-end">
              <button
                type="submit"
                disabled={isLoading}
                className="flex items-center gap-2 bg-brown hover:bg-brown-dark text-white font-semibold py-3 px-6 rounded-xl transition-colors duration-200"
              >
                <Save size={18} />
                {isLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Settings;
