import { Link } from 'react-router-dom';
import { ArrowLeft, Home, Shield, Scale } from 'lucide-react';

const TermsAndConditions = () => {
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
                <Scale className="w-8 h-8 text-gold" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-heading font-bold text-white">Terms and Conditions</h1>
                <p className="text-white/70 text-sm mt-1">SmartHOA — Southwynd Residences</p>
              </div>
            </div>
            <p className="text-white/60 text-sm">Last updated: September 4, 2026</p>
          </div>

          <div className="px-8 sm:px-12 py-8 sm:py-10 space-y-8 text-gray-700 leading-relaxed">
            <Section num="1" title="Acceptance of Terms">
              <p>By accessing or using the SmartHOA system ("the System"), you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions. If you do not agree, you must not use the System.</p>
              <p className="mt-2">The System is operated by and for the Homeowners Association (HOA) of Southwynd Residences. Use is limited to authorized residents, homeowners, renters, HOA officers, and administrators.</p>
            </Section>

            <Section num="2" title="User Accounts and Registration">
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>You must provide accurate, complete, and current information during registration.</li>
                <li>You are responsible for maintaining the confidentiality of your login credentials.</li>
                <li>You must not share your account credentials with any other person.</li>
                <li>You are responsible for all activities that occur under your account.</li>
                <li>You must immediately notify the HOA office if you suspect unauthorized access.</li>
                <li>The HOA reserves the right to suspend or deactivate accounts that violate these terms.</li>
              </ul>
            </Section>

            <Section num="3" title="Acceptable Use">
              <p>You agree to use the System only for its intended purposes:</p>
              <ul className="list-disc list-inside space-y-2 ml-2 mt-2">
                <li>Viewing and managing your HOA payment obligations.</li>
                <li>Submitting, tracking, and managing complaints and service requests.</li>
                <li>Receiving official HOA announcements and notifications.</li>
                <li>Accessing community analytics and reports (for authorized roles).</li>
              </ul>
              <p className="mt-3 font-semibold">You must NOT:</p>
              <ul className="list-disc list-inside space-y-2 ml-2 mt-2">
                <li>Use the System for any unlawful purpose.</li>
                <li>Upload false, misleading, defamatory, or fraudulent information.</li>
                <li>Submit fraudulent payment receipts or falsify payment records.</li>
                <li>Attempt to gain unauthorized access to other users' accounts or data.</li>
                <li>Interfere with or compromise the security or integrity of the System.</li>
                <li>Upload files containing viruses, malware, or harmful software.</li>
              </ul>
            </Section>

            <Section num="4" title="Payment Terms">
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>Monthly HOA dues and other fees are determined by the HOA Board.</li>
                <li>Payments must be made on or before the due date indicated in the System.</li>
                <li>Proof of payment must be uploaded for verification and approval by an HOA Officer.</li>
                <li>The HOA may impose penalties or surcharges on overdue payments per the HOA bylaws.</li>
                <li>The System serves as a monitoring tool; it does not process financial transactions directly.</li>
              </ul>
            </Section>

            <Section num="5" title="Complaint and Service Request Policy">
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>Complaints must be submitted truthfully and in good faith.</li>
                <li>Residents must select the appropriate category for their complaint.</li>
                <li>Attached images or files must be relevant to the complaint.</li>
                <li>The HOA will endeavor to address complaints in a timely manner but does not guarantee specific resolution times.</li>
                <li>Abusive, threatening, or harassing language is strictly prohibited and may result in account suspension.</li>
              </ul>
            </Section>

            <Section num="6" title="Data Privacy and Collection">
              <p>Your use of the System is also governed by our <Link to="/privacy-policy" className="text-brown font-semibold hover:text-brown-dark underline underline-offset-2">Privacy Policy</Link>.</p>
              <ul className="list-disc list-inside space-y-2 ml-2 mt-2">
                <li>The System collects personal information necessary for HOA operations (name, email, contact number, property details).</li>
                <li>Payment records and complaint history are stored for administrative and analytics purposes.</li>
                <li>Your data will not be sold or shared with third parties outside the HOA except as required by law.</li>
                <li>The System complies with the Philippine Data Privacy Act of 2012 (Republic Act No. 10173).</li>
              </ul>
            </Section>

            <Section num="7" title="Intellectual Property">
              <p>All content, design, logos, trademarks, software, and materials within the SmartHOA System are the property of the Southwynd Residences HOA and its developers. You may not reproduce, distribute, or modify any part without prior written consent.</p>
            </Section>

            <Section num="8" title="System Availability and Limitations">
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>The HOA does not guarantee uninterrupted System access.</li>
                <li>Scheduled maintenance may temporarily affect availability.</li>
                <li>The HOA is not liable for loss or inconvenience caused by System downtime.</li>
                <li>The System is provided "as is" without warranties of any kind.</li>
              </ul>
            </Section>

            <Section num="9" title="Limitation of Liability">
              <p>To the fullest extent permitted by law, the Southwynd Residences HOA, its officers, developers, and administrators shall not be liable for any indirect, incidental, special, or consequential damages arising from use of the System.</p>
            </Section>

            <Section num="10" title="Termination">
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>The HOA may suspend or terminate your account for violation of these Terms.</li>
                <li>Upon termination of residency or lease, your account will be deactivated.</li>
                <li>You may request account deactivation by contacting the HOA office.</li>
              </ul>
            </Section>

            <Section num="11" title="Amendments">
              <p>The HOA reserves the right to update these Terms at any time. Users will be notified of significant changes through the System. Continued use after changes constitutes acceptance of the revised terms.</p>
            </Section>

            <Section num="12" title="Governing Law">
              <p>These Terms shall be governed by the laws of the Republic of the Philippines. Disputes shall be subject to the exclusive jurisdiction of the applicable courts.</p>
            </Section>

            <Section num="13" title="Contact Information">
              <p>For questions about these Terms, please contact:</p>
              <div className="mt-3 bg-cream rounded-2xl p-6 border border-brown/10">
                <p className="font-bold text-brown-dark">Southwynd Residences Homeowners Association</p>
                <p className="text-sm text-gray-600 mt-1">HOA Management Office</p>
                <p className="text-sm text-gray-600">Email: hoa@southwyndresidences.com</p>
              </div>
            </Section>

            <div className="border-t border-gray-200 pt-8 mt-10">
              <div className="bg-brown/5 rounded-2xl p-6 border border-brown/10 text-center">
                <Shield className="w-10 h-10 text-brown mx-auto mb-3" />
                <p className="text-sm text-gray-600">By creating an account and using the SmartHOA system, you acknowledge that you have read, understood, and agree to abide by these Terms and Conditions.</p>
                <div className="mt-4 flex flex-col sm:flex-row gap-3 justify-center">
                  <Link to="/register" className="bg-brown hover:bg-brown-dark text-white px-8 py-3 rounded-xl font-semibold transition-colors shadow-sm text-sm">Back to Registration</Link>
                  <Link to="/privacy-policy" className="bg-white hover:bg-gray-50 text-brown border border-brown/20 px-8 py-3 rounded-xl font-semibold transition-colors text-sm">View Privacy Policy</Link>
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

export default TermsAndConditions;
