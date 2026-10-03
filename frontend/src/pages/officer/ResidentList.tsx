import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { Search, MapPin, Mail, Phone, X, CheckCircle2 } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../../config/api';

interface Resident {
  resident_id: string;
  first_name: string;
  last_name: string;
  email: string;
  contact_number: string | null;
  resident_type: string;
  account_status: string;
  block: string | null;
  lot: string | null;
  property_use: 'Homeowner' | 'Renter' | 'Airbnb';
}

const ResidentList = () => {
  const { token } = useAuthStore();
  const [residents, setResidents] = useState<Resident[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
  const [blockInput, setBlockInput] = useState<string>('');
  const [lotInput, setLotInput] = useState<string>('');
  const [propertyUse, setPropertyUse] = useState<'Homeowner' | 'Renter' | 'Airbnb'>('Homeowner');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [emailMessage, setEmailMessage] = useState('');
  const [emailError, setEmailError] = useState('');

  const fetchData = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/officer/get_residents.php`, { headers: { Authorization: `Bearer ${token}` } });
      setResidents(response.data);
    } catch (error) {
      console.error("Failed to load data", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchData();
  }, [token]);

  const handleOpenManage = (resident: Resident) => {
    setSelectedResident(resident);
    setBlockInput(resident.block || '');
    setLotInput(resident.lot || '');
    setPropertyUse(resident.property_use || (resident.resident_type === 'Renter' ? 'Renter' : 'Homeowner'));
    setEmailInput(resident.email);
    setEmailMessage('');
    setEmailError('');
    setIsModalOpen(true);
  };

  const handleAssignProperty = async () => {
    if (!selectedResident || !blockInput || !lotInput) return;
    setIsAssigning(true);

    try {
      await axios.post(`${API_BASE_URL}/api/officer/assign_property.php`, {
        resident_id: selectedResident.resident_id,
        block: blockInput,
        lot: lotInput,
        property_use: propertyUse
      }, { headers: { Authorization: `Bearer ${token}` } });
      
      await fetchData(); // Refresh tables
      setIsModalOpen(false);
    } catch (error) {
      console.error("Failed to assign property", error);
    } finally {
      setIsAssigning(false);
    }
  };

  const handleUpdateEmail = async () => {
    if (!selectedResident) return;

    const nextEmail = emailInput.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(nextEmail)) {
      setEmailError('Enter a valid email address.');
      setEmailMessage('');
      return;
    }

    if (nextEmail === selectedResident.email.toLowerCase()) {
      setEmailError('Enter a different email address to update this resident.');
      setEmailMessage('');
      return;
    }

    const isConfirmed = window.confirm(
      `Confirm that you verified ${selectedResident.first_name} ${selectedResident.last_name}'s identity. Update their SmartHOA email to ${nextEmail}? Any existing password-reset links will stop working.`
    );
    if (!isConfirmed) return;

    setIsUpdatingEmail(true);
    setEmailMessage('');
    setEmailError('');

    try {
      const response = await axios.post(`${API_BASE_URL}/api/officer/update_resident_email.php`, {
        resident_id: selectedResident.resident_id,
        email: nextEmail,
      }, { headers: { Authorization: `Bearer ${token}` } });

      setEmailInput(nextEmail);
      setSelectedResident((current) => current ? { ...current, email: nextEmail } : current);
      setResidents((current) => current.map((resident) =>
        resident.resident_id === selectedResident.resident_id
          ? { ...resident, email: nextEmail }
          : resident
      ));
      setEmailMessage(response.data?.message || 'Resident email updated.');
    } catch (error) {
      const message = axios.isAxiosError(error) ? error.response?.data?.message : null;
      setEmailError(message || 'Unable to update the resident email. Please try again.');
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  const filteredResidents = residents.filter(r => 
    `${r.first_name} ${r.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-gray-800 sm:text-3xl">Resident Directory</h1>
          <p className="text-gray-500 mt-2">Manage and view all residents within the community.</p>
        </div>
        
        <div className="flex w-full items-center rounded-xl border border-gray-200 bg-white px-4 py-2 shadow-sm transition-all focus-within:border-brown focus-within:ring-1 focus-within:ring-brown sm:w-72">
          <Search className="w-5 h-5 text-gray-400 mr-3" />
          <input 
            type="text" 
            placeholder="Search residents..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent border-none outline-none w-full text-sm placeholder-gray-400"
          />
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {isLoading ? (
          [...Array(3)].map((_, index) => (
            <div key={index} className="h-60 animate-pulse rounded-2xl border border-gray-100 bg-white p-5 shadow-sm" />
          ))
        ) : filteredResidents.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-white px-5 py-12 text-center text-gray-400 shadow-sm">
            No residents found.
          </div>
        ) : (
          filteredResidents.map((resident) => (
            <article key={resident.resident_id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-brown/20 bg-cream font-bold text-brown">
                  {resident.first_name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-bold text-gray-800">{resident.first_name} {resident.last_name}</h2>
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                      resident.account_status === 'Active'
                        ? 'border border-green-200 bg-green-50 text-green-700'
                        : 'border border-red-200 bg-red-50 text-red-700'
                    }`}>
                      {resident.account_status}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {resident.property_use === 'Airbnb' ? 'Homeowner · Airbnb Host' : resident.property_use === 'Renter' ? 'Renter-occupied property' : resident.resident_type || 'Unassigned Role'}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-2 border-y border-gray-100 py-4 text-sm">
                <p className="flex items-start gap-2 text-gray-600"><Mail size={15} className="mt-0.5 shrink-0 text-gray-400" /><span className="break-all">{resident.email}</span></p>
                {resident.contact_number && <p className="flex items-center gap-2 text-gray-600"><Phone size={15} className="shrink-0 text-gray-400" />{resident.contact_number}</p>}
                <p className="flex items-center gap-2 font-medium text-gray-700"><MapPin size={15} className="shrink-0 text-gray-400" />{resident.block && resident.lot ? `Blk ${resident.block}, Lot ${resident.lot}` : 'Property unassigned'}</p>
              </div>

              <button
                type="button"
                onClick={() => handleOpenManage(resident)}
                className="mt-4 min-h-11 w-full rounded-xl bg-brown/10 px-4 py-2.5 text-sm font-semibold text-brown transition-colors hover:bg-brown/20"
              >
                Manage resident
              </button>
            </article>
          ))
        )}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Resident</th>
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact</th>
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Property</th>
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-gray-400">Loading residents...</td>
                </tr>
              ) : filteredResidents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-gray-400">No residents found.</td>
                </tr>
              ) : (
                filteredResidents.map((resident) => (
                  <tr key={resident.resident_id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-cream flex items-center justify-center text-brown font-bold border border-brown/20">
                          {resident.first_name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800">{resident.first_name} {resident.last_name}</p>
                          <p className="text-xs text-gray-500">{resident.property_use === 'Airbnb' ? 'Homeowner · Airbnb Host' : resident.property_use === 'Renter' ? 'Renter-occupied property' : resident.resident_type || 'Unassigned Role'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="space-y-1">
                        <div className="flex items-center text-sm text-gray-600 gap-2">
                          <Mail size={14} className="text-gray-400" />
                          {resident.email}
                        </div>
                        {resident.contact_number && (
                          <div className="flex items-center text-sm text-gray-600 gap-2">
                            <Phone size={14} className="text-gray-400" />
                            {resident.contact_number}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      {resident.block && resident.lot ? (
                        <div>
                          <div className="flex items-center text-sm text-gray-700 font-medium gap-2 bg-gray-100 px-3 py-1 rounded-md inline-flex border border-gray-200">
                            <MapPin size={14} className="text-gray-500" />
                            Blk {resident.block}, Lot {resident.lot}
                          </div>
                          {resident.property_use === 'Airbnb' && <p className="text-xs text-brown font-semibold mt-1">Airbnb-hosted property</p>}
                          {resident.property_use === 'Renter' && <p className="text-xs text-gray-500 font-semibold mt-1">Renter-occupied property</p>}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400 italic px-3 py-1 bg-red-50 rounded-md inline-flex border border-red-100">Unassigned</span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        resident.account_status === 'Active' 
                          ? 'bg-green-50 text-green-700 border border-green-200' 
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}>
                        {resident.account_status}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <button 
                        onClick={() => handleOpenManage(resident)}
                        className="text-sm font-semibold text-brown hover:text-brown-dark bg-brown/10 hover:bg-brown/20 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Resident management modal */}
      {isModalOpen && selectedResident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 backdrop-blur-sm animate-in fade-in duration-200 sm:p-4">
          <div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl animate-in zoom-in-95 duration-200 sm:max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">Manage Resident</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4 overflow-y-auto p-5 sm:p-6">
              <div className="flex items-center gap-4 p-4 bg-cream rounded-xl border border-brown/10">
                <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-brown font-bold shadow-sm">
                  {selectedResident.first_name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-gray-800">{selectedResident.first_name} {selectedResident.last_name}</p>
                  <p className="truncate text-sm text-gray-500">{selectedResident.email}</p>
                </div>
              </div>

              <section className="rounded-xl border border-brown/15 bg-brown/5 p-4">
                <div className="flex items-start gap-3">
                  <Mail size={18} className="mt-0.5 shrink-0 text-brown" />
                  <div className="min-w-0 flex-1">
                    <h4 className="font-semibold text-gray-800">Account email</h4>
                    <p className="mt-1 text-xs leading-5 text-gray-600">Verify the resident’s identity before changing this. Existing password-reset links will be cancelled.</p>
                  </div>
                </div>
                <label className="sr-only" htmlFor="resident-account-email">Resident email address</label>
                <input
                  id="resident-account-email"
                  type="email"
                  value={emailInput}
                  onChange={(event) => {
                    setEmailInput(event.target.value);
                    setEmailMessage('');
                    setEmailError('');
                  }}
                  className="mt-3 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-brown focus:ring-1 focus:ring-brown"
                  placeholder="resident@example.com"
                />
                {emailMessage && <p className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-medium text-green-700">{emailMessage}</p>}
                {emailError && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{emailError}</p>}
              </section>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Block No.</label>
                  <input 
                    type="text"
                    placeholder="e.g. 1"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-brown focus:ring-1 focus:ring-brown bg-white"
                    value={blockInput}
                    onChange={(e) => setBlockInput(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Lot No.</label>
                  <input 
                    type="text"
                    placeholder="e.g. 15"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-brown focus:ring-1 focus:ring-brown bg-white"
                    value={lotInput}
                    onChange={(e) => setLotInput(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Property Registration</label>
                <select value={propertyUse} onChange={(event) => setPropertyUse(event.target.value as 'Homeowner' | 'Renter' | 'Airbnb')} className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-brown focus:ring-1 focus:ring-brown bg-white">
                  <option value="Homeowner">Homeowner Occupied</option>
                  <option value="Renter">Renter Occupied</option>
                  <option value="Airbnb">Airbnb Host Property</option>
                </select>
              </div>
              {propertyUse === 'Airbnb' && <p className="text-xs text-brown bg-brown/5 border border-brown/10 rounded-lg px-3 py-2">This marks the property as Airbnb-hosted and identifies this resident as its host.</p>}
              {propertyUse === 'Renter' && <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">This marks the property as renter-occupied without changing the selected resident's account role.</p>}
            </div>

            <div className="flex flex-col gap-2 border-t border-gray-100 bg-gray-50 px-5 py-4 sm:flex-row sm:justify-between sm:gap-3 sm:px-6">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="min-h-11 rounded-xl px-5 py-2.5 font-semibold text-gray-600 transition-colors hover:bg-gray-200"
              >
                Cancel
              </button>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={handleUpdateEmail}
                  disabled={isUpdatingEmail}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-brown bg-white px-5 py-2.5 font-semibold text-brown transition-colors hover:bg-brown/10 disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-400"
                >
                  <Mail size={18} />
                  {isUpdatingEmail ? 'Updating...' : 'Update email'}
                </button>
                <button
                  onClick={handleAssignProperty}
                  disabled={!blockInput || !lotInput || isAssigning}
                  className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2.5 font-semibold text-white transition-colors ${
                    !blockInput || !lotInput || isAssigning ? 'bg-brown/50 cursor-not-allowed' : 'bg-brown hover:bg-brown-dark'
                  }`}
                >
                  {isAssigning ? 'Assigning...' : <><CheckCircle2 size={18} /> Confirm Assignment</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResidentList;
