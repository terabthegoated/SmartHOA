import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Mail, Lock, Phone, Eye, EyeOff } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../../config/api';
import swrLogo from '../../assets/brand/swr-logo.png';

const Register = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    contact_number: '',
    resident_type: 'Homeowner',
    property_use: 'Homeowner',
    block: '',
    lot: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
      ...(name === 'resident_type' && value === 'Renter' ? { property_use: 'Renter' } : {})
    });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!strongPasswordRegex.test(formData.password)) {
      setError('Password must be at least 8 characters long and include an uppercase letter, a lowercase letter, a number, and a special character.');
      return;
    }

    if (formData.password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/register.php`, formData);
      setSuccess(response.data.message || 'Registration successful! You can now log in.');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] bg-cream">
      <div className="hidden lg:flex lg:w-1/2 bg-brown relative overflow-hidden flex-col justify-center items-start px-20">
        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
        <div className="relative z-10 text-white space-y-6">
          <Link to="/" className="mb-8 block w-full max-w-md rounded-xl bg-white p-2 shadow-lg transition-opacity hover:opacity-90">
            <img src={swrLogo} alt="Southwynd San Pablo Homeowners Association" className="w-full h-auto" />
          </Link>

          <h2 className="text-5xl font-bold font-heading leading-tight text-white [-webkit-text-stroke:1px_#4B352A]">Join Our <br />Community</h2>
          <p className="text-lg opacity-80 max-w-md pt-4">
            Register your account to manage your property, submit complaints, and stay updated with the homeowners association.
          </p>
        </div>
      </div>

      <div className="flex w-full items-start justify-center p-4 py-6 lg:w-1/2 lg:items-center lg:p-8">
        <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl shadow-brown/5 animate-in fade-in slide-in-from-bottom-8 duration-700 sm:rounded-3xl sm:p-8 lg:p-10">

          <Link to="/" className="mb-6 block rounded-xl bg-cream p-2 ring-1 ring-brown/10 lg:hidden">
            <img src={swrLogo} alt="Southwynd San Pablo Homeowners Association" className="w-full h-auto" />
          </Link>

          <div className="mb-8">
            <h3 className="text-2xl font-heading font-bold text-gray-800 sm:text-3xl">Create Account</h3>
            <p className="text-gray-500 mt-2">Please fill in your details to register.</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 border border-red-100 rounded-xl text-sm font-semibold">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-50 text-green-700 border border-green-100 rounded-xl text-sm font-semibold">
              {success} Redirecting to login...
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">First Name</label>
                <div className="relative">
                  <input
                    type="text"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleChange}
                    className="min-h-12 w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 outline-none transition-all focus:border-brown focus:ring-1 focus:ring-brown"
                    required
                  />
                  <User className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Last Name</label>
                <div className="relative">
                  <input
                    type="text"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleChange}
                    className="min-h-12 w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 outline-none transition-all focus:border-brown focus:ring-1 focus:ring-brown"
                    required
                  />
                  <User className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Email Address</label>
              <div className="relative">
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="min-h-12 w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 outline-none transition-all focus:border-brown focus:ring-1 focus:ring-brown"
                  required
                />
                <Mail className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className="min-h-12 w-full rounded-xl border border-gray-200 py-3 pl-10 pr-12 outline-none transition-all focus:border-brown focus:ring-1 focus:ring-brown"
                    required
                    minLength={8}
                  />
                  <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3.5 text-gray-400 hover:text-brown transition-colors focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="min-h-12 w-full rounded-xl border border-gray-200 py-3 pl-10 pr-12 outline-none transition-all focus:border-brown focus:ring-1 focus:ring-brown"
                    required
                    minLength={8}
                  />
                  <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-3.5 text-gray-400 hover:text-brown transition-colors focus:outline-none"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Contact Number</label>
              <div className="relative">
                <input
                  type="tel"
                  name="contact_number"
                  value={formData.contact_number}
                  onChange={handleChange}
                  className="min-h-12 w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 outline-none transition-all focus:border-brown focus:ring-1 focus:ring-brown"
                />
                <Phone className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Resident Type</label>
                <select
                  name="resident_type"
                  value={formData.resident_type}
                  onChange={handleChange}
                  className="min-h-12 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-brown focus:ring-1 focus:ring-brown"
                >
                  <option value="Homeowner">Homeowner</option>
                  <option value="Renter">Renter</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Property Registration</label>
                <select
                  name="property_use"
                  value={formData.property_use}
                  onChange={handleChange}
                  className="min-h-12 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-brown focus:ring-1 focus:ring-brown"
                >
                  <option value="Homeowner">Homeowner Occupied</option>
                  <option value="Renter">Renter Occupied</option>
                  <option value="Airbnb">Airbnb Host Property</option>
                </select>
              </div>
            </div>
            {formData.resident_type === 'Homeowner' && formData.property_use === 'Airbnb' && (
              <p className="text-xs text-brown bg-brown/5 border border-brown/10 rounded-lg px-3 py-2">The selected block and lot will be recorded as an Airbnb-hosted property. Short-term guests are not registered as permanent residents.</p>
            )}
            {formData.property_use === 'Renter' && (
              <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">The selected block and lot will be recorded as renter-occupied. The renter remains a regular SmartHOA resident account.</p>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Block</label>
                <input type="text" name="block" value={formData.block} onChange={handleChange} className="min-h-12 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none transition-all focus:border-brown focus:ring-1 focus:ring-brown" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Lot</label>
                <input type="text" name="lot" value={formData.lot} onChange={handleChange} className="min-h-12 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none transition-all focus:border-brown focus:ring-1 focus:ring-brown" required />
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <div className="flex items-center h-5">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-brown focus:ring-brown bg-white transition-all cursor-pointer mt-0.5"
                    required
                  />
                </div>
                <div className="text-xs text-gray-600 leading-tight">
                  By creating an account, I agree to the <Link to="/terms-and-conditions" className="text-brown hover:text-brown-dark font-semibold underline underline-offset-2 transition-colors">Terms and Conditions</Link> and <Link to="/privacy-policy" className="text-brown hover:text-brown-dark font-semibold underline underline-offset-2 transition-colors">Privacy Policy</Link> of SmartHOA Southwynd Residences.
                </div>
              </label>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={isLoading}
                className={`min-h-12 w-full rounded-xl py-3 font-semibold text-white transition-colors duration-200 ${isLoading ? 'bg-brown/70 cursor-not-allowed' : 'bg-brown hover:bg-brown-dark shadow-md shadow-brown/20'
                  }`}
              >
                {isLoading ? 'REGISTERING...' : 'CREATE ACCOUNT'}
              </button>
            </div>
          </form>

          <div className="mt-8 text-center text-sm text-gray-600">
            Already have an account? <Link to="/login" className="font-semibold text-brown hover:text-brown-dark transition-colors">Sign In Here</Link>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Register;
