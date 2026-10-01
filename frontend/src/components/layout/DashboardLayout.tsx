import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopNavbar from './TopNavbar';
import { useUIStore } from '../../store/uiStore';

const DashboardLayout = () => {
  const { isSidebarOpen, closeSidebar } = useUIStore();

  return (
    <div className="flex min-h-screen bg-cream relative">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={closeSidebar}
        />
      )}
      
      <Sidebar />
      <div className="flex-1 md:ml-64 flex flex-col w-full min-w-0">
        <TopNavbar />
        <main className="p-4 md:p-8 flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
