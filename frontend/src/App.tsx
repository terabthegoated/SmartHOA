import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ProtectedRoute from './routes/ProtectedRoute';
import DashboardLayout from './components/layout/DashboardLayout';

// Pages are loaded only when their route is opened.  This keeps reporting,
// charting, and PDF-export code out of the first mobile screen.
const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/auth/Login'));
const Register = lazy(() => import('./pages/auth/Register'));
const TermsAndConditions = lazy(() => import('./pages/TermsAndConditions'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const ResidentDashboard = lazy(() => import('./pages/resident/ResidentDashboard'));
const MyPayments = lazy(() => import('./pages/resident/MyPayments'));
const MyComplaints = lazy(() => import('./pages/resident/MyComplaints'));
const OfficerDashboard = lazy(() => import('./pages/officer/OfficerDashboard'));
const ResidentList = lazy(() => import('./pages/officer/ResidentList'));
const Payments = lazy(() => import('./pages/officer/Payments'));
const Complaints = lazy(() => import('./pages/officer/Complaints'));
const Settings = lazy(() => import('./pages/Settings'));
const Announcements = lazy(() => import('./pages/Announcements'));

const PageLoadingFallback = () => (
  <div className="min-h-screen bg-cream flex items-center justify-center p-6" role="status" aria-live="polite">
    <div className="rounded-2xl border border-brown/10 bg-white px-6 py-5 text-center shadow-sm">
      <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-brown/20 border-t-brown" />
      <p className="text-sm font-semibold text-brown-dark">Loading SmartHOA…</p>
    </div>
  </div>
);

function App() {
  return (
    <Router>
      <Suspense fallback={<PageLoadingFallback />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          
          {/* Protected Officer Routes wrapped in DashboardLayout */}
          <Route element={<ProtectedRoute allowedRoles={['Super Administrator', 'HOA Officer']} />}>
            <Route element={<DashboardLayout />}>
              <Route path="/officer-dashboard" element={<OfficerDashboard />} />
              <Route path="/residents" element={<ResidentList />} />
              <Route path="/payments" element={<Payments />} />
              <Route path="/complaints" element={<Complaints />} />
            </Route>
          </Route>

          {/* Protected Resident Routes wrapped in DashboardLayout */}
          <Route element={<ProtectedRoute allowedRoles={['Homeowner', 'Renter']} />}>
            <Route element={<DashboardLayout />}>
              <Route path="/resident-dashboard" element={<ResidentDashboard />} />
              <Route path="/my-payments" element={<MyPayments />} />
              <Route path="/my-complaints" element={<MyComplaints />} />
            </Route>
          </Route>

          {/* Generic Protected Routes (Settings, Announcements, etc.) wrapped in DashboardLayout */}
          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/settings" element={<Settings />} />
              <Route path="/announcements" element={<Announcements />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
