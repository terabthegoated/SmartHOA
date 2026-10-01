import { lazy, Suspense, useCallback, useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import axios from 'axios';
import { API_BASE_URL } from '../../config/api';
import { Users, Home, CreditCard, AlertCircle, TrendingUp, Lightbulb, ArrowRight, Timer, Star, ShieldAlert, ClipboardList, CircleDollarSign, Download, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import swrLogo from '../../assets/brand/swr-logo.png';

const AnalyticsCharts = lazy(() => import('../../components/analytics/AnalyticsCharts'));

interface AnalyticsData {
  total_residents: number;
  total_properties: number;
  airbnb_properties: number;
  renter_properties: number;
  outstanding_dues: number;
  pending_verifications: number;
  current_month_billed: number;
  current_month_collected: number;
  collection_rate: number | null;
  overdue_accounts: number;
  open_complaints: number;
  high_priority_complaints: number;
  aged_complaints: number;
  average_resolution_days: number | null;
  average_satisfaction: number | null;
  satisfaction_response_count: number;
  monthly_revenue: Array<{ name: string; collected: number; pending: number }>;
  complaints_by_category: Array<{ name: string; value: number }>;
  complaints_by_priority: Array<{ name: string; value: number }>;
  payment_compliance: Array<{ name: string; value: number }>;
  dss_insights: Array<{
    severity: 'high' | 'medium' | 'positive';
    title: string;
    evidence: string;
    recommendation: string;
    action_url: string;
  }>;
}

const insightStyles = {
  high: 'border-red-200 bg-red-50 text-red-700',
  medium: 'border-amber-200 bg-amber-50 text-amber-700',
  positive: 'border-emerald-200 bg-emerald-50 text-emerald-700'
};

const toFiniteNumber = (value: unknown) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

const AnalyticsChartsLoading = () => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-pulse" aria-label="Loading analytics charts">
    {[...Array(4)].map((_, index) => (
      <div key={index} className="h-96 rounded-2xl border border-gray-100 bg-white shadow-sm" />
    ))}
  </div>
);

const OfficerDashboard = () => {
  const { user, token } = useAuthStore();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    if (!token) {
      setData(null);
      setError('Your session has expired. Please sign in again.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await axios.get(`${API_BASE_URL}/api/officer/get_analytics.php`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const result: Record<string, unknown> = response.data && typeof response.data === 'object' && !Array.isArray(response.data)
        ? response.data as Record<string, unknown>
        : {};
      const toChartData = (values: unknown) => Array.isArray(values)
        ? values.flatMap((item) => {
          if (!item || typeof item !== 'object') return [];
          const record = item as Record<string, unknown>;
          if (typeof record.name !== 'string') return [];
          return [{ name: record.name, value: toFiniteNumber(record.value) }];
        })
        : [];
      const toInsights = (values: unknown): AnalyticsData['dss_insights'] => Array.isArray(values)
        ? values.flatMap((item) => {
          if (!item || typeof item !== 'object') return [];
          const record = item as Record<string, unknown>;
          if (typeof record.title !== 'string' || typeof record.evidence !== 'string' || typeof record.recommendation !== 'string') return [];
          return [{
            severity: record.severity === 'high' || record.severity === 'positive' ? record.severity : 'medium',
            title: record.title,
            evidence: record.evidence,
            recommendation: record.recommendation,
            action_url: typeof record.action_url === 'string' ? record.action_url : '/officer-dashboard'
          }];
        })
        : [];

      // PostgreSQL aggregate values are sent as strings. Normalize every chart
      // series here so Recharts always receives reliable numbers.
      const parsedData: AnalyticsData = {
        total_residents: toFiniteNumber(result.total_residents),
        total_properties: toFiniteNumber(result.total_properties),
        airbnb_properties: toFiniteNumber(result.airbnb_properties),
        renter_properties: toFiniteNumber(result.renter_properties),
        outstanding_dues: toFiniteNumber(result.outstanding_dues),
        pending_verifications: toFiniteNumber(result.pending_verifications),
        current_month_billed: toFiniteNumber(result.current_month_billed),
        current_month_collected: toFiniteNumber(result.current_month_collected),
        collection_rate: result.collection_rate === null || result.collection_rate === undefined ? null : toFiniteNumber(result.collection_rate),
        overdue_accounts: toFiniteNumber(result.overdue_accounts),
        open_complaints: toFiniteNumber(result.open_complaints),
        high_priority_complaints: toFiniteNumber(result.high_priority_complaints),
        aged_complaints: toFiniteNumber(result.aged_complaints),
        average_resolution_days: result.average_resolution_days === null || result.average_resolution_days === undefined ? null : toFiniteNumber(result.average_resolution_days),
        average_satisfaction: result.average_satisfaction === null || result.average_satisfaction === undefined ? null : toFiniteNumber(result.average_satisfaction),
        satisfaction_response_count: toFiniteNumber(result.satisfaction_response_count),
        monthly_revenue: Array.isArray(result.monthly_revenue)
          ? result.monthly_revenue.flatMap((item: unknown) => {
            if (!item || typeof item !== 'object') return [];
            const record = item as Record<string, unknown>;
            if (typeof record.name !== 'string') return [];
            return [{
              name: record.name,
              collected: toFiniteNumber(record.collected),
              pending: toFiniteNumber(record.pending)
            }];
          })
          : [],
        complaints_by_category: toChartData(result.complaints_by_category),
        complaints_by_priority: toChartData(result.complaints_by_priority),
        payment_compliance: toChartData(result.payment_compliance),
        dss_insights: toInsights(result.dss_insights)
      };

      setData(parsedData);
    } catch (requestError) {
      console.error('Failed to load analytics', requestError);
      setData(null);
      const responseMessage = axios.isAxiosError(requestError) && typeof requestError.response?.data?.message === 'string'
        ? requestError.response.data.message
        : null;
      setError(responseMessage || 'We could not load the live community analytics. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchAnalytics();
  }, [fetchAnalytics]);

  const handleDownloadReport = async () => {
    const dashboardElement = document.getElementById('dashboard-report');
    if (!dashboardElement) return;

    try {
      // PDF tools are only needed after an officer explicitly exports a report.
      // Loading them here keeps the dashboard and ordinary mobile sign-in faster.
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf')
      ]);
      const canvas = await html2canvas(dashboardElement, {
        scale: 2, // High resolution
        useCORS: true,
        logging: false
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 10, pdfWidth, pdfHeight);
      pdf.save(`SmartHOA_Analytics_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      alert('Failed to generate PDF report.');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-heading font-bold text-gray-800">Community Analytics & Decision Support</h1>
          <p className="text-gray-500 mt-2">Welcome back, {user?.name || 'Officer'}! Review the evidence, then take action.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void fetchAnalytics()}
            disabled={isLoading}
            className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-xl font-semibold transition-colors flex items-center gap-2 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} /> Refresh data
          </button>
          <button type="button" onClick={handleDownloadReport} disabled={!data || isLoading} className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-xl font-semibold transition-colors flex items-center gap-2 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-60">
            <Download size={16} /> Export PDF
          </button>
          <Link to="/payments" className="bg-brown hover:bg-brown-dark text-white px-4 py-2 rounded-xl font-semibold transition-colors flex items-center gap-2 text-sm shadow-sm">
            <CreditCard size={16} /> Manage Finances
          </Link>
        </div>
      </div>

      <div id="dashboard-report" className="space-y-8 bg-[#FDFBF7] p-4 -m-4 rounded-xl">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="w-full max-w-sm rounded-lg bg-cream p-2 ring-1 ring-brown/10">
          <img src={swrLogo} alt="Southwynd San Pablo Homeowners Association" className="w-full h-auto" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-brown">Official community report</p>
          <h2 className="text-xl font-heading font-bold text-gray-800">Community Analytics & Decision Support</h2>
          <p className="text-sm text-gray-500">Generated from current SmartHOA records.</p>
        </div>
      </div>
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white h-32 rounded-2xl border border-gray-100 shadow-sm"></div>
          ))}
          <div className="col-span-1 lg:col-span-2 bg-white h-96 rounded-2xl border border-gray-100 shadow-sm"></div>
          <div className="col-span-1 lg:col-span-2 bg-white h-96 rounded-2xl border border-gray-100 shadow-sm"></div>
        </div>
       ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center" role="alert">
          <AlertCircle className="mx-auto text-red-600" size={32} />
          <h2 className="mt-3 text-lg font-bold text-red-900">Analytics could not be loaded</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-red-700">{error}</p>
          <button type="button" onClick={() => void fetchAnalytics()} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-800">
            <RefreshCw size={16} /> Try again
          </button>
        </div>
       ) : data ? (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-5 hover:shadow-md transition-shadow">
              <div className="p-4 bg-blue-50 text-blue-600 rounded-xl">
                <Users size={28} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-semibold mb-1">Total Residents</p>
                <h3 className="text-3xl font-bold text-gray-800">{data?.total_residents || 0}</h3>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-5 hover:shadow-md transition-shadow">
              <div className="p-4 bg-green-50 text-green-600 rounded-xl">
                <Home size={28} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-semibold mb-1">Properties</p>
                <h3 className="text-3xl font-bold text-gray-800">{data?.total_properties || 0}</h3>
                <p className="text-xs text-gray-400 mt-1">{data?.airbnb_properties || 0} Airbnb-hosted · {data?.renter_properties || 0} renter-occupied</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-5 hover:shadow-md transition-shadow">
              <div className="p-4 bg-red-50 text-red-600 rounded-xl">
                <TrendingUp size={28} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-semibold mb-1">Outstanding Dues</p>
                <h3 className="text-3xl font-bold text-gray-800">
                  ₱{Number(data?.outstanding_dues || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </h3>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-5 hover:shadow-md transition-shadow">
              <div className="p-4 bg-orange-50 text-orange-600 rounded-xl">
                <AlertCircle size={28} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-semibold mb-1">Pending Verifications</p>
                <h3 className="text-3xl font-bold text-gray-800">{data?.pending_verifications || 0}</h3>
              </div>
            </div>
          </div>

          {/* Decision-support KPIs */}
          <div>
            <div className="mb-4">
              <h2 className="text-lg font-bold text-gray-800">Operational Performance</h2>
              <p className="text-sm text-gray-500">Live indicators used by the recommendation rules below.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><CircleDollarSign size={24} /></div>
                <div><p className="text-sm text-gray-500 font-semibold">Collection Rate</p><h3 className="text-2xl font-bold text-gray-800">{data?.collection_rate !== null && data?.collection_rate !== undefined ? `${data.collection_rate}%` : '—'}</h3><p className="text-xs text-gray-400">Current month</p></div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-red-50 text-red-600 rounded-xl"><AlertCircle size={24} /></div>
                <div><p className="text-sm text-gray-500 font-semibold">Overdue Accounts</p><h3 className="text-2xl font-bold text-gray-800">{data?.overdue_accounts || 0}</h3><p className="text-xs text-gray-400">Current month</p></div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><ClipboardList size={24} /></div>
                <div><p className="text-sm text-gray-500 font-semibold">Open Complaints</p><h3 className="text-2xl font-bold text-gray-800">{data?.open_complaints || 0}</h3><p className="text-xs text-gray-400">Excludes resolved and closed</p></div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-orange-50 text-orange-600 rounded-xl"><ShieldAlert size={24} /></div>
                <div><p className="text-sm text-gray-500 font-semibold">High-Priority Open</p><h3 className="text-2xl font-bold text-gray-800">{data?.high_priority_complaints || 0}</h3><p className="text-xs text-gray-400">High or critical priority</p></div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-purple-50 text-purple-600 rounded-xl"><Timer size={24} /></div>
                <div><p className="text-sm text-gray-500 font-semibold">Avg. Resolution Time</p><h3 className="text-2xl font-bold text-gray-800">{data?.average_resolution_days !== null && data?.average_resolution_days !== undefined ? `${data.average_resolution_days} d` : '—'}</h3><p className="text-xs text-gray-400">Resolved and closed cases</p></div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-yellow-50 text-yellow-600 rounded-xl"><Star size={24} /></div>
                <div><p className="text-sm text-gray-500 font-semibold">Resident Satisfaction</p><h3 className="text-2xl font-bold text-gray-800">{data?.average_satisfaction !== null && data?.average_satisfaction !== undefined ? `${data.average_satisfaction} / 5` : '—'}</h3><p className="text-xs text-gray-400">{data?.satisfaction_response_count || 0} feedback response(s)</p></div>
              </div>
            </div>
          </div>

          {/* Explainable DSS recommendations */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-start gap-3 mb-5">
              <div className="p-2 bg-brown/10 text-brown rounded-lg"><Lightbulb size={22} /></div>
              <div><h2 className="text-lg font-bold text-gray-800">Decision Support Recommendations</h2><p className="text-sm text-gray-500">Each recommendation is based on a visible rule and its supporting community data.</p></div>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {data?.dss_insights?.map((insight, index) => (
                <div key={`${insight.title}-${index}`} className={`rounded-xl border p-4 ${insightStyles[insight.severity]}`}>
                  <div className="flex items-start justify-between gap-4"><div><h3 className="font-bold text-gray-900">{insight.title}</h3><p className="text-sm text-gray-700 mt-1">{insight.evidence}</p><p className="text-sm font-medium text-gray-800 mt-3">Recommended action: {insight.recommendation}</p></div><Link to={insight.action_url} className="shrink-0 rounded-lg bg-white/70 hover:bg-white p-2 text-gray-700 transition-colors" aria-label={`Open ${insight.title}`}><ArrowRight size={18} /></Link></div>
                </div>
              ))}
            </div>
          </div>

          <Suspense fallback={<AnalyticsChartsLoading />}>
            <AnalyticsCharts
              monthlyRevenue={data.monthly_revenue}
              complaintsByCategory={data.complaints_by_category}
              paymentCompliance={data.payment_compliance}
              complaintsByPriority={data.complaints_by_priority}
            />
          </Suspense>
        </>
       ) : (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          No analytics records are available yet. Refresh after the first billing or complaint activity.
        </div>
       )}
      </div>
    </div>
  );
};

export default OfficerDashboard;
