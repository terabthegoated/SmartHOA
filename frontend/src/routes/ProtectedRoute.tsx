
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const ProtectedRoute = ({ allowedRoles }: { allowedRoles?: string[] }) => {
  const { isAuthenticated, user }: any = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If route is restricted by role
  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    // Redirect them to their appropriate dashboard if unauthorized
    const isOfficer = user?.role === 'Super Administrator' || user?.role === 'HOA Officer';
    return <Navigate to={isOfficer ? "/officer-dashboard" : "/resident-dashboard"} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
