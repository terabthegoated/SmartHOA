import { ArrowLeft, Eye, EyeOff, Lock } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../../config/api';
import swrLogo from '../../assets/brand/swr-logo.png';

const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_])[A-Za-z\d@$!%*?&_]{8,}$/;

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!strongPasswordRegex.test(password)) {
      setError('Password must be at least 8 characters long and include an uppercase letter, a lowercase letter, a number, and a special character such as _ or !.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/reset_password.php`, { token, password });
      setSuccess(response.data?.message || 'Your password has been reset. You can now log in.');
      window.setTimeout(() => navigate('/login', { replace: true }), 1800);
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) ? err.response?.data?.message : null;
      setError(message || 'Unable to reset the password. Please request another link.');
    } finally {
      setIsLoading(false);
    }
  };

  const linkIsPresent = /^[a-f0-9]{64}$/.test(token);

  return (
    <div className="flex min-h-[100dvh] bg-cream">
      <div className="hidden lg:flex lg:w-1/2 bg-brown-dark text-white p-12 flex-col justify-between" style={{
        backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }}>
        <Link to="/" className="block w-full max-w-md rounded-xl bg-white p-2 shadow-lg transition-opacity hover:opacity-90">
          <img src={swrLogo} alt="Southwynd San Pablo Homeowners Association" className="w-full h-auto" />
        </Link>
        <div>
          <h1 className="text-5xl font-heading font-bold leading-tight">Choose a new,<br />strong password.</h1>
          <p className="mt-6 max-w-md text-lg text-gray-300">For your security, this reset link can be used only once.</p>
        </div>
        <p className="text-sm text-gray-400">© 2026 SmartHOA Systems. All rights reserved.</p>
      </div>

      <main className="flex w-full items-start justify-center p-4 py-6 lg:w-1/2 lg:items-center lg:p-8">
        <section className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-8 lg:p-10">
          <Link to="/" className="mb-6 block rounded-xl bg-cream p-2 ring-1 ring-brown/10 lg:hidden">
            <img src={swrLogo} alt="Southwynd San Pablo Homeowners Association" className="w-full h-auto" />
          </Link>
          <Link to="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-brown hover:text-brown-dark">
            <ArrowLeft size={17} /> Back to login
          </Link>
          <h1 className="mt-6 text-2xl font-heading font-bold text-gray-800 sm:text-3xl">Create a new password</h1>
          <p className="mt-2 text-gray-500">Use at least 8 characters with uppercase, lowercase, a number, and a special character.</p>

          {!linkIsPresent && <div className="mt-6 rounded-xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">This password-reset link is incomplete or invalid. Please request a new link.</div>}
          {error && <div className="mt-6 rounded-xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
          {success && <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-700">{success} Redirecting to login...</div>}

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-600">New password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required minLength={8} disabled={!linkIsPresent || isLoading} className="min-h-12 w-full rounded-lg border border-gray-200 py-3 pl-10 pr-12 outline-none transition-all focus:border-brown focus:ring-1 focus:ring-brown disabled:bg-gray-50" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} disabled={!linkIsPresent || isLoading} className="absolute right-3 top-3.5 text-gray-400 hover:text-brown disabled:cursor-not-allowed"><span className="sr-only">Show or hide password</span>{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>
              </div>
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-600">Confirm new password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
                <input type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" required minLength={8} disabled={!linkIsPresent || isLoading} className="min-h-12 w-full rounded-lg border border-gray-200 py-3 pl-10 pr-12 outline-none transition-all focus:border-brown focus:ring-1 focus:ring-brown disabled:bg-gray-50" />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} disabled={!linkIsPresent || isLoading} className="absolute right-3 top-3.5 text-gray-400 hover:text-brown disabled:cursor-not-allowed"><span className="sr-only">Show or hide password</span>{showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>
              </div>
            </div>
            <button type="submit" disabled={!linkIsPresent || isLoading || Boolean(success)} className="min-h-12 w-full rounded-xl bg-brown py-3 font-semibold text-white transition-colors hover:bg-brown-dark disabled:cursor-not-allowed disabled:bg-brown/70">
              {isLoading ? 'RESETTING PASSWORD...' : 'RESET PASSWORD'}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
};

export default ResetPassword;
