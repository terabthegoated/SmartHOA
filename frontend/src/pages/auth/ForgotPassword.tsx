import { ArrowLeft, Mail } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../../config/api';
import swrLogo from '../../assets/brand/swr-logo.png';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/request_password_reset.php`, { email });
      setSuccess(response.data?.message || 'If an account matches that email address, a password-reset link has been sent.');
    } catch (err: unknown) {
      const message = axios.isAxiosError(err) ? err.response?.data?.message : null;
      setError(message || 'Unable to send a password-reset link. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

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
          <h1 className="text-5xl font-heading font-bold leading-tight">Account recovery,<br />made safe.</h1>
          <p className="mt-6 max-w-md text-lg text-gray-300">We will email a one-time link to reset your SmartHOA password.</p>
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
          <h1 className="mt-6 text-2xl font-heading font-bold text-gray-800 sm:text-3xl">Reset your password</h1>
          <p className="mt-2 text-gray-500">Enter your email address and we will send a secure reset link if it matches an account.</p>

          {error && <div className="mt-6 rounded-xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
          {success && <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-700">{success}</div>}

          <form onSubmit={handleSubmit} className="mt-6 space-y-6">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-600">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Enter your email"
                  autoComplete="email"
                  required
                  className="min-h-12 w-full rounded-lg border border-gray-200 py-3 pl-10 pr-4 outline-none transition-all focus:border-brown focus:ring-1 focus:ring-brown"
                />
              </div>
            </div>
            <button type="submit" disabled={isLoading} className="min-h-12 w-full rounded-xl bg-brown py-3 font-semibold text-white transition-colors hover:bg-brown-dark disabled:cursor-not-allowed disabled:bg-brown/70">
              {isLoading ? 'SENDING LINK...' : 'SEND RESET LINK'}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
};

export default ForgotPassword;
