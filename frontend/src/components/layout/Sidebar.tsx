import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  MessageSquare,
  Bell,
  Settings,
  LogOut,
  X
} from 'lucide-react';
import swrLogo from '../../assets/brand/swr-logo.png';

const Sidebar = () => {
  const { user, logout } = useAuthStore();
  const { isSidebarOpen, closeSidebar } = useUIStore();
  const location = useLocation();

  const isOfficer = user?.role === 'Super Administrator' || user?.role === 'HOA Officer';

  const menuItems = [
    {
      title: 'Dashboard',
      icon: <LayoutDashboard size={20} />,
      path: isOfficer ? '/officer-dashboard' : '/resident-dashboard'
    },
    ...(isOfficer ? [
      { title: 'Residents', icon: <Users size={20} />, path: '/residents' },
    ] : []),
    { title: 'Payments', icon: <CreditCard size={20} />, path: isOfficer ? '/payments' : '/my-payments' },
    { title: 'Complaints', icon: <MessageSquare size={20} />, path: isOfficer ? '/complaints' : '/my-complaints' },
    { title: 'Announcements', icon: <Bell size={20} />, path: '/announcements' },
    { title: 'Settings', icon: <Settings size={20} />, path: '/settings' },
  ];

  return (
    <div className={`w-64 h-screen bg-brown-dark text-white flex flex-col fixed left-0 top-0 z-50 transition-transform duration-300 md:translate-x-0 ${
      isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
    }`}>
      <div className="p-4 flex items-center justify-between gap-2 border-b border-white/10">
        <Link to={isOfficer ? '/officer-dashboard' : '/resident-dashboard'} onClick={closeSidebar} className="min-w-0 flex-1 rounded-lg bg-white p-1.5 shadow-sm hover:bg-cream transition-colors">
          <img src={swrLogo} alt="Southwynd San Pablo Homeowners Association" className="w-full h-auto" />
        </Link>
        <button className="md:hidden text-gray-400 hover:text-white" onClick={closeSidebar}>
          <X size={24} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-6">
        <nav className="space-y-1 px-3">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={closeSidebar}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive
                    ? 'bg-brown text-gold font-semibold'
                    : 'text-gray-300 hover:bg-white/5 hover:text-white'
                  }`}
              >
                {item.icon}
                <span className="text-sm tracking-wide">{item.title}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-white/10">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-gray-300 hover:bg-red-500/10 hover:text-red-400 transition-colors"
        >
          <LogOut size={20} />
          <span className="text-sm font-semibold tracking-wide">Logout</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
