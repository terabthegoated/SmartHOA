import { Link } from 'react-router-dom';
import { Home, CreditCard, MessageSquare, Bell, ArrowRight } from 'lucide-react';
import swrLogo from '../assets/brand/swr-logo.png';

const Landing = () => {
  return (
    <div className="min-h-screen bg-cream text-brown-dark font-sans selection:bg-gold selection:text-brown-dark flex flex-col">
      {/* Navigation */}
      <nav className="fixed w-full z-50 bg-cream/80 backdrop-blur-md border-b border-brown/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <Link to="/" className="shrink-0 rounded-lg bg-white p-1 shadow-sm ring-1 ring-brown/10" aria-label="Southwynd Residences Homeowners Association home">
            <img src={swrLogo} alt="Southwynd San Pablo Homeowners Association" className="h-7 w-auto max-w-[150px] object-contain sm:h-10 sm:max-w-[240px]" />
          </Link>

          <div className="flex items-center gap-2 sm:gap-4">
            <Link to="/login" className="font-semibold text-brown hover:text-brown-dark transition-colors px-2 sm:px-4 py-2 whitespace-nowrap text-sm sm:text-base">
              Log In
            </Link>
            <Link to="/register" className="bg-brown hover:bg-brown-dark text-white px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg sm:rounded-xl font-semibold transition-colors shadow-sm text-sm sm:text-base whitespace-nowrap">
              Register
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-grow pt-32 pb-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

            {/* Left Content */}
            <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700 mt-4 sm:mt-0">
              <div className="w-full max-w-md rounded-2xl bg-white p-2 shadow-sm ring-1 ring-brown/10">
                <img src={swrLogo} alt="Southwynd San Pablo Homeowners Association" className="w-full h-auto" />
              </div>
              <div className="inline-block bg-brown/5 text-brown font-bold text-xs sm:text-sm px-4 py-2 rounded-full border border-brown/10">
                Welcome to Southwynd Residences
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-7xl font-heading font-bold leading-[1.1] text-brown-dark">
                Modern living, <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-brown to-gold">managed brilliantly.</span>
              </h1>
              <p className="text-base sm:text-lg text-gray-600 max-w-xl leading-relaxed">
                SmartHOA is your all-in-one community portal. Pay dues, submit maintenance requests, and stay updated with neighborhood announcements—all from the comfort of your home.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-2 sm:pt-4">
                <Link to="/login" className="bg-gradient-to-r from-brown-dark to-brown hover:from-brown hover:to-brown-dark text-white px-8 py-3.5 sm:py-4 rounded-xl font-bold transition-all shadow-lg shadow-brown/20 flex items-center justify-center gap-2 group text-sm sm:text-base">
                  Access Portal
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link to="/register" className="bg-white hover:bg-gray-50 text-brown border border-brown/20 px-8 py-3.5 sm:py-4 rounded-xl font-bold transition-all shadow-sm text-center text-sm sm:text-base">
                  Create Account
                </Link>
              </div>
            </div>

            {/* Right Graphics/Features */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 animate-in fade-in slide-in-from-right-8 duration-700 delay-150">
              {/* Feature 1 */}
              <div className="bg-yellow-50 p-8 rounded-3xl border border-yellow-100 shadow-xl shadow-gray-200/50 hover:-translate-y-1 transition-transform duration-300">
                <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
                  <CreditCard size={28} />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">Easy Payments</h3>
                <p className="text-gray-500 text-sm">Upload receipts and track your monthly HOA dues with a crystal clear billing history.</p>
              </div>

              {/* Feature 2 */}
              <div className="bg-yellow-50 p-8 rounded-3xl border border-yellow-100 shadow-xl shadow-gray-200/50 hover:-translate-y-1 transition-transform duration-300 mt-0 sm:mt-12">
                <div className="w-14 h-14 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center mb-6">
                  <MessageSquare size={28} />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">Complaint Desk</h3>
                <p className="text-gray-500 text-sm">Report issues instantly. Snap a photo, submit a ticket, and track its resolution in real-time.</p>
              </div>

              {/* Feature 3 */}
              <div className="bg-yellow-50 p-8 rounded-3xl border border-yellow-100 shadow-xl shadow-gray-200/50 hover:-translate-y-1 transition-transform duration-300">
                <div className="w-14 h-14 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mb-6">
                  <Home size={28} />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">Property Profile</h3>
                <p className="text-gray-500 text-sm">Manage your household details and assign block and lot information effortlessly.</p>
              </div>

              {/* Feature 4 */}
              <div className="bg-yellow-50 p-8 rounded-3xl border border-yellow-100 shadow-xl shadow-gray-200/50 hover:-translate-y-1 transition-transform duration-300 mt-0 sm:mt-12">
                <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mb-6">
                  <Bell size={28} />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">Live Updates</h3>
                <p className="text-gray-500 text-sm">Never miss a beat. Get instant access to community announcements and alerts.</p>
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-brown-dark py-8 text-center text-white/50 text-sm mt-auto">
        <div className="max-w-7xl mx-auto px-6">
          <p>© {new Date().getFullYear()} SmartHOA - Southwynd Subdivision. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
