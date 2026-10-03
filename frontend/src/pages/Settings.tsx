import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { User, Mail, Phone, Home, Save, Database, AlertTriangle, LoaderCircle, Bell, BellRing, KeyRound, LogOut } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { Capacitor } from '@capacitor/core';
import { enableWebPushNotifications, webPushPermission } from '../services/webPushNotifications';
import { registerNativePushNotifications } from '../services/pushNotifications';

const Settings = () => {
  const { user, token, logout } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [demoConfirmation, setDemoConfirmation] = useState('');
  const [isCreatingDemoData, setIsCreatingDemoData] = useState(false);
  const [demoMessage, setDemoMessage] = useState('');
  const [demoError, setDemoError] = useState('');
  const [demoCredentials, setDemoCredentials] = useState<{ password: string; accounts: { label: string; email: string }[] } | null>(null);
  const [isEnablingNotifications, setIsEnablingNotifications] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationError, setNotificationError] = useState('');
  const [isSendingPasswordReset, setIsSendingPasswordReset] = useState(false);
  const [passwordResetMessage, setPasswordResetMessage] = useState('');
  const [passwordResetError, setPasswordResetError] = useState('');

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

  useEffect(() => {
    const showNativePushStatus = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string; isError?: boolean }>).detail;
      if (!detail?.message) return;
      setNotificationMessage(detail.isError ? '' : detail.message);
      setNotificationError(detail.isError ? detail.message : '');
      setIsEnablingNotifications(false);
    };

    window.addEventListener('smarthoa-native-push-status', showNativePushStatus);
    return () => window.removeEventListener('smarthoa-native-push-status', showNativePushStatus);
  }, []);

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

  const createDemoData = async () => {
    if (demoConfirmation.trim() !== 'CREATE DEMO DATA') {
      setDemoError('Type CREATE DEMO DATA exactly to continue.');
      return;
    }

    setIsCreatingDemoData(true);
    setDemoError('');
    setDemoMessage('');

    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/officer/seed_demo_data.php`,
        { confirmation: 'CREATE_DEMO_DATA' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setDemoMessage(response.data?.message || 'Demo data is ready.');
      setDemoCredentials(response.data?.credentials || null);
      setDemoConfirmation('');
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message
        : null;
      setDemoError(message || 'Unable to create demo data. Please try again.');
    } finally {
      setIsCreatingDemoData(false);
    }
  };

  const enableDeviceNotifications = async () => {
    if (!token) return;
    setIsEnablingNotifications(true);
    setNotificationMessage('');
    setNotificationError('');

    try {
      if (Capacitor.isNativePlatform()) {
        const result = await registerNativePushNotifications(token);
        setNotificationMessage(result.message);
        setNotificationError(result.isError ? result.message : '');
        if (result.isError) setNotificationMessage('');
        return;
      }
      await enableWebPushNotifications(token);
      setNotificationMessage('Device notifications are on for this SmartHOA app.');
    } catch (error) {
      setNotificationError(error instanceof Error ? error.message : 'Unable to enable device notifications.');
    } finally {
      setIsEnablingNotifications(false);
    }
  };

  const sendPasswordResetEmail = async () => {
    if (!formData.email) return;

    setIsSendingPasswordReset(true);
    setPasswordResetMessage('');
    setPasswordResetError('');

    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/request_password_reset.php`, {
        email: formData.email,
      });
      setPasswordResetMessage(response.data?.message || 'If an account matches this email, a password-reset link has been sent.');
    } catch (error) {
      const message = axios.isAxiosError(error) ? error.response?.data?.message : null;
      setPasswordResetError(message || 'Unable to send a password-reset link. Please try again.');
    } finally {
      setIsSendingPasswordReset(false);
    }
  };

  const notificationPermission = webPushPermission();
  const isNativeApp = Capacitor.isNativePlatform();

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

      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 shrink-0 rounded-xl bg-brown/10 text-brown flex items-center justify-center">
              <KeyRound size={21} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">Password &amp; sign-in</h2>
              <p className="text-sm text-gray-600 mt-1 max-w-xl">
                Send a secure, one-time password-reset link to <span className="font-semibold text-gray-800">{formData.email || 'your registered email address'}</span>. The link expires after 30 minutes.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={sendPasswordResetEmail}
            disabled={isSendingPasswordReset || !formData.email}
            className="shrink-0 inline-flex justify-center items-center gap-2 bg-brown hover:bg-brown-dark disabled:bg-gray-400 text-white font-semibold py-3 px-5 rounded-xl transition-colors"
          >
            <Mail size={18} />
            {isSendingPasswordReset ? 'Sending link...' : 'Reset my password'}
          </button>
        </div>
        {(passwordResetMessage || passwordResetError) && (
          <div className={`mx-6 mb-6 rounded-xl border p-4 text-sm font-semibold ${passwordResetError ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}>
            {passwordResetError || passwordResetMessage}
          </div>
        )}
      </section>

      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 shrink-0 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              {notificationPermission === 'granted' ? <BellRing size={21} /> : <Bell size={21} />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">Device notifications</h2>
              <p className="text-sm text-gray-600 mt-1 max-w-xl">
                {isNativeApp
                  ? 'Connect this Android phone to receive announcements, payment updates, reminders, and complaint updates. Android may ask for notification permission.'
                  : 'Receive announcements, payment updates, reminders, and complaint updates on this device. On iPhone, open SmartHOA from its Home Screen icon before turning notifications on.'}
              </p>
            </div>
          </div>
          {isNativeApp ? (
            <button
              type="button"
              onClick={enableDeviceNotifications}
              disabled={isEnablingNotifications}
              className="shrink-0 inline-flex justify-center items-center gap-2 bg-brown hover:bg-brown-dark disabled:bg-gray-400 text-white font-semibold py-3 px-5 rounded-xl transition-colors"
            >
              {isEnablingNotifications ? 'Connecting...' : 'Connect notifications'}
            </button>
          ) : (
            <button
              type="button"
              onClick={enableDeviceNotifications}
              disabled={isEnablingNotifications || notificationPermission === 'granted'}
              className="shrink-0 inline-flex justify-center items-center gap-2 bg-brown hover:bg-brown-dark disabled:bg-green-600 disabled:cursor-default text-white font-semibold py-3 px-5 rounded-xl transition-colors"
            >
              {isEnablingNotifications
                ? 'Turning on...'
                : notificationPermission === 'granted'
                  ? 'Notifications enabled'
                  : 'Turn on notifications'}
            </button>
          )}
        </div>
        {(notificationMessage || notificationError) && (
          <div className={`mx-6 mb-6 rounded-xl border p-4 text-sm font-semibold ${notificationError ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}>
            {notificationError || notificationMessage}
          </div>
        )}
      </section>

      <section className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden">
        <div className="p-6 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 shrink-0 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <LogOut size={21} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">Log out</h2>
              <p className="text-sm text-gray-600 mt-1 max-w-xl">Sign out of SmartHOA on this device. You can sign back in anytime.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="shrink-0 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-5 py-3 font-semibold text-red-700 transition-colors hover:bg-red-50"
          >
            <LogOut size={18} />
            Log out
          </button>
        </div>
      </section>

      {user?.role === 'Super Administrator' && (
        <section className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-amber-100 bg-amber-50/70 flex items-start gap-4">
            <div className="w-11 h-11 shrink-0 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Database size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">Development &amp; Testing</h2>
              <p className="text-sm text-gray-600 mt-1">
                Create fictional records so every SmartHOA feature can be demonstrated before the public rollout.
              </p>
            </div>
          </div>

          <div className="p-6 space-y-5">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3 text-sm text-amber-900">
              <AlertTriangle size={20} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Testing only</p>
                <p className="mt-1">
                  This adds fictional DEMO residents, properties, dues, complaints, announcements, and in-app notifications.
                  It never imports the HOA Dues Record, never deletes existing records, and can be safely run again.
                </p>
              </div>
            </div>

            {demoMessage && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                <p className="font-semibold">{demoMessage}</p>
                {demoCredentials && (
                  <div className="mt-3 pt-3 border-t border-green-200 space-y-1">
                    <p>All demo accounts use password: <code className="font-bold">{demoCredentials.password}</code></p>
                    {demoCredentials.accounts.map((account) => (
                      <p key={account.email}>{account.label}: <code className="font-semibold">{account.email}</code></p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {demoError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                {demoError}
              </div>
            )}

            <div className="max-w-md">
              <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
                To create demo data, type CREATE DEMO DATA
              </label>
              <input
                type="text"
                value={demoConfirmation}
                onChange={(event) => setDemoConfirmation(event.target.value)}
                placeholder="CREATE DEMO DATA"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-brown focus:ring-1 focus:ring-brown outline-none"
              />
            </div>

            <button
              type="button"
              onClick={createDemoData}
              disabled={isCreatingDemoData}
              className="inline-flex items-center gap-2 bg-brown hover:bg-brown-dark disabled:bg-gray-400 text-white font-semibold py-3 px-5 rounded-xl transition-colors"
            >
              {isCreatingDemoData ? <LoaderCircle size={18} className="animate-spin" /> : <Database size={18} />}
              {isCreatingDemoData ? 'Creating demo data...' : 'Create demo data'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
};

export default Settings;
