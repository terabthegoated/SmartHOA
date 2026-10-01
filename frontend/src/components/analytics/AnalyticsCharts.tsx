import { BarChart3, PieChart as PieChartIcon, ShieldAlert } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

type ChartDatum = { name: string; value: number };
type MonthlyRevenueDatum = { name: string; collected: number; pending: number };

interface AnalyticsChartsProps {
  monthlyRevenue: MonthlyRevenueDatum[];
  complaintsByCategory: ChartDatum[];
  paymentCompliance: ChartDatum[];
  complaintsByPriority: ChartDatum[];
}

const COLORS = ['#D4AF37', '#8B5A2B', '#A0522D', '#CD853F', '#DEB887'];

/**
 * Kept in its own lazy-loaded chunk because Recharts is useful only on the
 * analytics screen. The surrounding dashboard can render while charts load.
 */
const AnalyticsCharts = ({
  monthlyRevenue,
  complaintsByCategory,
  paymentCompliance,
  complaintsByPriority
}: AnalyticsChartsProps) => (
  <>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <div className="p-2 bg-green-50 text-green-600 rounded-lg"><BarChart3 size={20} /></div>
          <div>
            <h2 className="text-lg font-bold text-gray-800">Payment Status Trend</h2>
            <p className="text-sm text-gray-500">Paid and unpaid billed amounts by billing month.</p>
          </div>
        </div>
        <div className="h-80 w-full">
          {monthlyRevenue.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyRevenue} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} dx={-10} tickFormatter={(value) => `₱${value / 1000}k`} />
                <Tooltip
                  cursor={{ fill: '#F3F4F6' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                  formatter={(value) => [`₱${Number(value).toLocaleString()}`, '']}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey="collected" name="Paid bills" fill="#D4AF37" radius={[4, 4, 0, 0]} barSize={30} />
                <Bar dataKey="pending" name="Unpaid bills" fill="#E5E7EB" radius={[4, 4, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">No billing records are available for the last six months.</div>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <div className="p-2 bg-orange-50 text-orange-600 rounded-lg"><PieChartIcon size={20} /></div>
          <div>
            <h2 className="text-lg font-bold text-gray-800">Complaints by Category</h2>
            <p className="text-sm text-gray-500">Categories with reported community issues.</p>
          </div>
        </div>
        <div className="h-80 w-full">
          {complaintsByCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={complaintsByCategory} cx="50%" cy="50%" innerRadius={80} outerRadius={120} paddingAngle={5} dataKey="value">
                  {complaintsByCategory.map((_, index) => <Cell key={`complaint-category-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} itemStyle={{ color: '#1F2937', fontWeight: 600 }} />
                <Legend iconType="circle" layout="vertical" verticalAlign="middle" align="right" />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">No complaint data available</div>
          )}
        </div>
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><PieChartIcon size={20} /></div>
          <div>
            <h2 className="text-lg font-bold text-gray-800">Payment Compliance</h2>
            <p className="text-sm text-gray-500">Distribution of current payment-record statuses.</p>
          </div>
        </div>
        <div className="h-80 w-full">
          {paymentCompliance.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={paymentCompliance} cx="50%" cy="50%" innerRadius={80} outerRadius={120} paddingAngle={5} dataKey="value" nameKey="name">
                  {paymentCompliance.map((item, index) => <Cell key={`${item.name}-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} itemStyle={{ color: '#1F2937', fontWeight: 600 }} />
                <Legend iconType="circle" layout="vertical" verticalAlign="middle" align="right" />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">No payment-status records are available yet.</div>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <div className="p-2 bg-red-50 text-red-600 rounded-lg"><ShieldAlert size={20} /></div>
          <div>
            <h2 className="text-lg font-bold text-gray-800">Complaint Priority Distribution</h2>
            <p className="text-sm text-gray-500">Rule-based and officer-confirmed priority levels.</p>
          </div>
        </div>
        <div className="h-80 w-full">
          {complaintsByPriority.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={complaintsByPriority} layout="vertical" margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={80} axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} itemStyle={{ color: '#1F2937', fontWeight: 600 }} />
                <Bar dataKey="value" name="Complaints" fill="#A0522D" radius={[0, 4, 4, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">No complaint-priority data is available yet.</div>
          )}
        </div>
      </div>
    </div>
  </>
);

export default AnalyticsCharts;
