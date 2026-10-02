import { Link, useLocation } from 'react-router-dom';
import { CreditCard, LayoutDashboard, MessageSquare, Settings } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

const MobileBottomNav = () => {
  const { user } = useAuthStore();
  const location = useLocation();
  const isOfficer = user?.role === 'Super Administrator' || user?.role === 'HOA Officer';

  if (isOfficer) return null;

  const items = [
    { label: 'Home', path: '/resident-dashboard', icon: LayoutDashboard },
    { label: 'Bills', path: '/my-payments', icon: CreditCard },
    { label: 'Reports', path: '/my-complaints', icon: MessageSquare },
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <nav
      aria-label="Resident mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(39,30,25,0.08)] backdrop-blur md:hidden"
    >
      <div className="mx-auto grid max-w-lg grid-cols-4">
        {items.map(({ label, path, icon: Icon }) => {
          const isActive = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-semibold transition-colors ${
                isActive ? 'bg-brown/10 text-brown' : 'text-gray-500 hover:bg-gray-50 hover:text-brown'
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
