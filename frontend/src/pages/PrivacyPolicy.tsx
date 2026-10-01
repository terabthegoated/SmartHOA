import { Link } from 'react-router-dom';
import { ArrowLeft, Home, Shield, Lock } from 'lucide-react';

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-cream">
      <nav className="sticky top-0 z-50 bg-cream/80 backdrop-blur-md border-b border-brown/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 sm:gap-3 hover:opacity-80 transition-opacity">
            <div className="p-1 sm:p-1.5 border-2 border-gold rounded-full bg-brown-dark">
              <Home className="w-5 h-5 sm:w-6 sm:h-6 text-gold" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl sm:text-2xl font-heading font-bold text-brown-dark tracking-tight leading-none">SmartHOA</span>
              <span className="text-[10px] sm:text-xs text-brown font-semibold tracking-widest uppercase mt-0.5">Southwynd Residences</span>
            </div>
          </Link>
          <Link to="/register" className="flex items-center gap-2 text-brown hover:text-brown-dark font-semibold transition-colors text-sm">
            <ArrowLeft size={16} /> Back to Register
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        <div className="bg-white rounded-3xl shadow-xl shadow-brown/5 border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-brown-dark to-brown px-8 sm:px-12 py-8 sm:py-10">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-sm">
                <Lock className="w-8 h-8 text-gold" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-heading font-bold text-white">Privacy Policy</h1>
                <p className="text-white/70 text-sm mt-1">SmartHOA — Southwynd Residences</p>
              </div>
            </div>
            <p className="text-white/60 text-sm">Last updated: September 4, 2026</p>
          </div>

          <div className="px-8 sm:px-12 py-8 sm:py-10 space-y-8 text-gray-700 leading-relaxed">
            
            <p className="font-semibold text-lg border-l-4 border-brown pl-4">
              The Southwynd Residences Homeowners Association ("we," "our," or "us") respects your privacy and is committed to protecting your personal data in compliance with the Philippine Data Privacy Act of 2012 (Republic Act No. 10173).
            </p>

            <Section num="1" title="Information We Collect">
              <p>When you register and use the SmartHOA System, we collect the following types of personal information:</p>
              <ul className="list-disc list-inside space-y-2 ml-2 mt-2">
                <li><strong>Personal Identifiers:</strong> First name, last name, email address, contact number.</li>
                <li><strong>Property Information:</strong> Resident type (Homeowner/Renter), block, and lot number.</li>
                <li><strong>Account Credentials:</strong> Passwords (which are securely hashed and never stored in plain text).</li>
                <li><strong>System Activity:</strong> Payment history, uploaded receipts, complaint records, and interaction logs.</li>
              </ul>
            </Section>

            <Section num="2" title="How We Use Your Information">
              <p>Your personal data is strictly used for the administration and operation of Southwynd Residences. Specifically, we use your data to:</p>
              <ul className="list-disc list-inside space-y-2 ml-2 mt-2">
                <li>Verify your identity and eligibility as a resident of the subdivision.</li>
                <li>Process, track, and manage your HOA dues and payment receipts.</li>
                <li>Receive, process, and resolve your complaints and service requests.</li>
                <li>Send official community announcements, payment reminders, and emergency notifications.</li>
                <li>Generate aggregated, anonymized community analytics to improve HOA operations.</li>
              </ul>
            </Section>

            <Section num="3" title="Data Sharing and Disclosure">
              <p>We do not sell, rent, or trade your personal information. Your data is only accessible to:</p>
              <ul className="list-disc list-inside space-y-2 ml-2 mt-2">
                <li><strong>Authorized HOA Officers and Administrators:</strong> For official community management purposes only.</li>
                <li><strong>System Administrators:</strong> For technical support and system maintenance.</li>
              </ul>
              <p className="mt-2">We will only disclose your information to external parties if required by law, court order, or lawful request by government authorities.</p>
            </Section>

            <Section num="4" title="Data Security">
              <p>We implement strict security measures to protect your data against unauthorized access, alteration, disclosure, or destruction. This includes:</p>
              <ul className="list-disc list-inside space-y-2 ml-2 mt-2">
                <li>Secure password hashing (bcrypt).</li>
                <li>Encrypted connections (HTTPS) for all data transmissions.</li>
                <li>Role-Based Access Control (RBAC) ensuring officers only see what is necessary for their duties.</li>
                <li>Secure cloud infrastructure hosted by reputable providers (Supabase).</li>
              </ul>
            </Section>

            <Section num="5" title="Data Retention">
              <p>We retain your personal information only for as long as you are a resident of Southwynd Residences or as necessary to fulfill the purposes outlined in this policy. Upon termination of your residency or lease, your account will be deactivated, and your data may be anonymized or securely deleted in accordance with HOA retention policies.</p>
            </Section>

            <Section num="6" title="Your Rights as a Data Subject">
              <p>Under the Data Privacy Act of 2012, you have the right to:</p>
              <ul className="list-disc list-inside space-y-2 ml-2 mt-2">
                <li>Be informed about how your data is processed.</li>
                <li>Access the personal data we hold about you.</li>
                <li>Update or correct inaccuracies in your data via the System's profile settings.</li>
                <li>Object to the processing of your data, subject to HOA membership requirements.</li>
                <li>Request the suspension, withdrawal, or blocking of your data if unlawfully processed.</li>
              </ul>
            </Section>

            <Section num="7" title="Changes to this Policy">
              <p>We may update this Privacy Policy periodically. We will notify you of any significant changes by posting the new Privacy Policy on the System and sending an announcement notification. You are advised to review this Privacy Policy periodically for any changes.</p>
            </Section>

            <Section num="8" title="Contact Us">
              <p>If you have any questions or concerns regarding this Privacy Policy or how your data is handled, please contact the HOA Management Office via the SmartHOA System or email us at <strong>hoa@southwyndresidences.com</strong>.</p>
            </Section>

            <div className="border-t border-gray-200 pt-8 mt-10">
              <div className="bg-brown/5 rounded-2xl p-6 border border-brown/10 text-center">
                <Shield className="w-10 h-10 text-brown mx-auto mb-3" />
                <p className="text-sm text-gray-600">By creating an account and using the SmartHOA system, you acknowledge that you have read and agree to this Privacy Policy.</p>
                <div className="mt-4 flex flex-col sm:flex-row gap-3 justify-center">
                  <Link to="/register" className="bg-brown hover:bg-brown-dark text-white px-8 py-3 rounded-xl font-semibold transition-colors shadow-sm text-sm">Back to Registration</Link>
                  <Link to="/terms-and-conditions" className="bg-white hover:bg-gray-50 text-brown border border-brown/20 px-8 py-3 rounded-xl font-semibold transition-colors text-sm">View Terms & Conditions</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-brown-dark py-8 text-center text-white/50 text-sm mt-8">
        <p>© {new Date().getFullYear()} SmartHOA - Southwynd Residences. All rights reserved.</p>
      </footer>
    </div>
  );
};

const Section = ({ num, title, children }: { num: string; title: string; children: React.ReactNode }) => (
  <section>
    <h2 className="text-xl font-heading font-bold text-brown-dark mb-3 flex items-center gap-2">
      <span className="w-8 h-8 bg-brown/10 text-brown rounded-lg flex items-center justify-center text-sm font-bold">{num}</span>
      {title}
    </h2>
    {children}
  </section>
);

export default PrivacyPolicy;
