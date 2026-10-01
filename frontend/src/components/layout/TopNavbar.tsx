import { useState, useEffect, useRef } from 'react';
import { Bell, Search, User, CheckCircle2, MessageSquare, CreditCard, AlertCircle, Menu } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../../config/api';

interface Notification {
  notification_id: string;
  title: string;
  message: string;
  notification_type: 'General' | 'Payment' | 'Complaint' | 'System';
  is_read: boolean;
  created_at: string;
}

const TopNavbar = () => {
  const { user, token } = useAuthStore();
  const { toggleSidebar } = useUIStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/shared/get_notifications.php`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(response.data);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  };

  useEffect(() => {
    if (!token) return;

    // Let the dashboard request its essential data first. On the local PHP
    // server this avoids the notification request delaying the first screen.
    const firstCheck = window.setTimeout(() => {
      void fetchNotifications();
    }, 800);

    // Continue checking in the background after the first screen is ready.
    const interval = window.setInterval(() => {
      void fetchNotifications();
    }, 30000);

    return () => {
      window.clearTimeout(firstCheck);
      window.clearInterval(interval);
    };
  }, [token]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAsRead = async (id: string, isAlreadyRead: boolean) => {
    if (isAlreadyRead) return;
    
    try {
      await axios.post(`${API_BASE_URL}/api/shared/mark_notification_read.php`, {
        notification_id: id
      }, { headers: { Authorization: `Bearer ${token}` } });
      
      setNotifications(prev => 
        prev.map(n => n.notification_id === id ? { ...n, is_read: true } : n)
      );
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'Payment': return <CreditCard className="w-5 h-5 text-blue-500" />;
      case 'Complaint': return <MessageSquare className="w-5 h-5 text-orange-500" />;
      case 'System': return <AlertCircle className="w-5 h-5 text-red-500" />;
      default: return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  const getBgColor = (type: string) => {
    switch (type) {
      case 'Payment': return 'bg-blue-50';
      case 'Complaint': return 'bg-orange-50';
      case 'System': return 'bg-red-50';
      default: return 'bg-gray-50';
    }
  };

  const getLink = (type: string) => {
    const isOfficer = user?.role === 'Super Administrator' || user?.role === 'HOA Officer';
    switch (type) {
      case 'Payment': return isOfficer ? '/payments' : '/my-payments';
      case 'Complaint': return isOfficer ? '/complaints' : '/my-complaints';
      case 'General': return '/announcements';
      default: return isOfficer ? '/officer-dashboard' : '/resident-dashboard';
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <header className="h-20 bg-white border-b border-gray-100 flex items-center justify-between px-4 md:px-8 sticky top-0 z-40">
      <div className="flex items-center gap-4 w-full max-w-md">
        <button 
          onClick={toggleSidebar}
          className="md:hidden p-2 -ml-2 text-gray-500 hover:text-brown transition-colors rounded-lg hover:bg-gray-50"
        >
          <Menu className="w-6 h-6" />
        </button>
        <div className="hidden md:flex items-center bg-gray-50 rounded-lg px-4 py-2 w-full border border-gray-100 focus-within:border-brown focus-within:ring-1 focus-within:ring-brown transition-all">
          <Search className="w-5 h-5 text-gray-400 mr-3" />
        <input 
          type="text" 
          placeholder="Search residents, payments, complaints..." 
          className="bg-transparent border-none outline-none w-full text-sm placeholder-gray-400"
        />
      </div>
      </div>

      <div className="flex items-center gap-6">
        {/* Notification Bell */}
        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => setShowDropdown(!showDropdown)}
            className={`relative p-2 transition-colors rounded-full ${showDropdown ? 'bg-brown/10 text-brown' : 'text-gray-400 hover:text-brown hover:bg-gray-50'}`}
          >
            <Bell className="w-6 h-6" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
            )}
          </button>

          {/* Notification Dropdown */}
          {showDropdown && (
            <div className="fixed inset-x-3 top-[5.5rem] z-50 w-auto max-h-[calc(100dvh-6.25rem)] overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl animate-in fade-in slide-in-from-top-2 duration-200 md:absolute md:inset-x-auto md:top-auto md:right-0 md:mt-3 md:w-96 md:max-h-none">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                <h3 className="font-bold text-gray-800">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="bg-brown text-gold text-xs font-bold px-2 py-1 rounded-full">
                    {unreadCount} New
                  </span>
                )}
              </div>
              
              <div className="max-h-[calc(100dvh-12rem)] overflow-y-auto md:max-h-96">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">
                    <CheckCircle2 className="mx-auto w-8 h-8 mb-2 opacity-20" />
                    <p className="text-sm">You're all caught up!</p>
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <Link 
                      key={notif.notification_id}
                      to={getLink(notif.notification_type)}
                      onClick={() => {
                        markAsRead(notif.notification_id, notif.is_read);
                        setShowDropdown(false);
                      }}
                      className={`flex items-start gap-4 p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors ${!notif.is_read ? 'bg-blue-50/30' : ''}`}
                    >
                      <div className={`p-2 rounded-xl mt-1 shrink-0 ${getBgColor(notif.notification_type)}`}>
                        {getIcon(notif.notification_type)}
                      </div>
                      <div>
                        <h4 className={`text-sm mb-1 ${!notif.is_read ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'}`}>
                          {notif.title}
                        </h4>
                        <p className="text-xs text-gray-500 line-clamp-2">{notif.message}</p>
                        <span className="text-[10px] text-gray-400 mt-2 block font-medium">
                          {new Date(notif.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {!notif.is_read && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 shrink-0"></div>
                      )}
                    </Link>
                  ))
                )}
              </div>
              
              <div className="p-3 border-t border-gray-100 bg-gray-50 text-center">
                <Link to="/settings" className="text-xs font-bold text-brown hover:text-brown-dark" onClick={() => setShowDropdown(false)}>
                  Notification Settings
                </Link>
              </div>
            </div>
          )}
        </div>
        
        <Link to="/settings" className="flex items-center gap-3 pl-6 border-l border-gray-200 cursor-pointer hover:opacity-80 transition-opacity">
          <div className="text-right">
            <p className="text-sm font-semibold text-gray-700">{user?.name || 'Demo User'}</p>
            <p className="text-xs text-gray-500">{user?.role || 'Role'}</p>
          </div>
          <div className="w-10 h-10 bg-cream rounded-full flex items-center justify-center text-brown font-bold border border-brown/20 shadow-sm">
            {user?.name ? user.name.charAt(0).toUpperCase() : <User size={20} />}
          </div>
        </Link>
      </div>
    </header>
  );
};

export default TopNavbar;
