import { Home, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from '../../store/authStore';
import { useGoogleLogin } from '@react-oauth/google';
import { API_BASE_URL } from '../../config/api';
import { registerNativePushNotifications } from '../../services/pushNotifications';
import { syncWebPushSubscription } from '../../services/webPushNotifications';
import swrLogo from '../../assets/brand/swr-logo.png';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const login = useAuthStore((state: any) => state.login);
  const navigate = useNavigate();

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setIsGoogleLoading(true);
      setError('');
      try {
        const response = await axios.post(`${API_BASE_URL}/api/auth/google_login.php`, {
          access_token: tokenResponse.access_token
        });
        
        login(response.data.user, response.data.token);
        void registerNativePushNotifications(response.data.token);
        void syncWebPushSubscription(response.data.token);

        const isOfficer = response.data.user.role === 'Super Administrator' || response.data.user.role === 'HOA Officer';
        navigate(isOfficer ? '/officer-dashboard' : '/resident-dashboard', { replace: true });

      } catch (err: any) {
        setError(err.response?.data?.message || 'Google Login failed.');
      } finally {
        setIsGoogleLoading(false);
      }
    },
    onError: () => {
      setError('Google Login was cancelled or failed.');
    }
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Point this to your PHP server URL (Port 8000)
      const API_URL = `${API_BASE_URL}/api/auth/login.php`;

      const response = await axios.post(API_URL, {
        email,
        password
      });

      if (response.data && response.data.token) {
        // Save to Zustand and LocalStorage
        login(response.data.user, response.data.token);
        void registerNativePushNotifications(response.data.token);
        void syncWebPushSubscription(response.data.token);

        // Redirect based on role
        if (response.data.user.role === 'Super Administrator' || response.data.user.role === 'HOA Officer') {
          navigate('/officer-dashboard');
        } else {
          navigate('/resident-dashboard');
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-brown-dark text-white p-12 flex-col justify-between" style={{
        backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)',
        backgroundSize: '40px 40px'
      }}>
        <Link to="/" className="mb-8 block w-full max-w-md rounded-xl bg-white p-2 shadow-lg transition-opacity hover:opacity-90">
          <img src={swrLogo} alt="Southwynd San Pablo Homeowners Association" className="w-full h-auto" />
        </Link>

        <div>
          <h2 className="text-5xl font-heading font-bold leading-tight mb-6 text-white">
            Intelligent<br />Community<br />Management
          </h2>
          <p className="text-lg text-gray-300 max-w-md">
            Southwynd Residences' automated platform for community harmony, data-driven insights, and transparent operations.
          </p>
        </div>

        <div className="text-sm text-gray-400">
          © 2026 SmartHOA Systems. All rights reserved.
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-cream">
        <div className="w-full max-w-md bg-white p-10 rounded-2xl shadow-sm border border-gray-100">
          <Link to="/" className="mb-6 block rounded-xl bg-cream p-2 ring-1 ring-brown/10 lg:hidden">
            <img src={swrLogo} alt="Southwynd San Pablo Homeowners Association" className="w-full h-auto" />
          </Link>
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-3xl font-heading font-bold">Welcome Back</h3>
            <Link to="/" className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-brown rounded-xl transition-colors border border-gray-100" title="Back to Home">
              <Home size={20} />
            </Link>
          </div>
          <p className="text-gray-500 mb-8">Please log in to your account.</p>

          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-sm font-semibold rounded-lg border border-red-100">
                {error}
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
                Username / Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all"
                  required
                />
                <svg className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                </svg>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-12 py-3 rounded-lg border border-gray-200 focus:border-brown focus:ring-1 focus:ring-brown outline-none transition-all"
                  required
                />
                <svg className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                </svg>
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3.5 text-gray-400 hover:text-brown transition-colors focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <a href="#" className="text-sm font-semibold text-brown hover:text-brown-dark">
                Forgot Password?
              </a>
            </div>

            <button
              type="submit"
              disabled={isLoading || isGoogleLoading}
              className={`w-full text-white font-semibold py-3 rounded-xl transition-colors duration-200 ${
                isLoading || isGoogleLoading ? 'bg-brown/70 cursor-not-allowed' : 'bg-brown hover:bg-brown-dark'
              }`}
            >
              {isLoading ? 'AUTHENTICATING...' : 'LOGIN'}
            </button>

            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-gray-200"></div>
              <span className="flex-shrink-0 mx-4 text-gray-400 text-sm font-semibold">OR</span>
              <div className="flex-grow border-t border-gray-200"></div>
            </div>

            <button
              type="button"
              onClick={() => handleGoogleLogin()}
              disabled={isLoading || isGoogleLoading}
              className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 text-gray-700 font-semibold py-3 rounded-xl hover:bg-gray-50 transition-colors duration-200"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {isGoogleLoading ? 'PLEASE WAIT...' : 'Continue with Google'}
            </button>
          </form>

          <div className="mt-8 text-center text-sm text-gray-600">
            Don't have an account? <Link to="/register" className="font-semibold text-brown hover:text-brown-dark transition-colors">Register Account</Link>
          </div>


        </div>
      </div>
    </div>
  );
};

export default Login;
