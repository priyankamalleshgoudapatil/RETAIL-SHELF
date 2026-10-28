import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { 
  BarChart3, 
  TrendingUp, 
  PieChart as PieIcon, 
  Download, 
  AlertTriangle, 
  Cpu, 
  RotateCcw,
  RefreshCw,
  FileSpreadsheet
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line,
  Legend
} from 'recharts';
import { api } from '../api/client';

export const AnalyticsPage: React.FC = () => {
  const { showToast } = useOutletContext<{ showToast: (msg: string, type?: string) => void }>();
  const [invAnalytics, setInvAnalytics] = useState<any>(null);
  const [restockAnalytics, setRestockAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchAnalytics = useCallback(async () => {
    try {
      const [inv, restock] = await Promise.all([
        api.getInventoryAnalytics(),
        api.getRestockingAnalytics()
      ]);
      setInvAnalytics(inv);
      setRestockAnalytics(restock);
    } catch (err: any) {
      showToast('Error loading analytics: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#94a3b8', '#0284c7', '#8b5cf6'];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Analytics & Retail Intelligence</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Turnover velocity, stockout frequencies, category fill rates, and sensor health telemetry.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={api.getAnalyticsExportUrl()}
            download
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-xs transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Export Full Analytics CSV
          </a>
          <button
            onClick={fetchAnalytics}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-16 text-center text-slate-400">Loading retail analytics...</div>
      ) : (
        <div className="space-y-6">
          {/* Row 1: Stockout Frequency & Category Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Low-Stock & Out-of-Stock Incident Frequency */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
              <div className="mb-4">
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" /> Stockout & Low-Stock Incident Frequency
                </h3>
                <p className="text-xs text-slate-500">Products experiencing the highest count of depletion events</p>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={invAnalytics?.incidentFrequency || []}
                    margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis 
                      dataKey="sku" 
                      tick={{ fontSize: 10, fill: '#64748b' }} 
                      angle={-25} 
                      textAnchor="end"
                    />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                    <Tooltip 
                      formatter={(val: any, name: any, item: any) => [
                        `${val} incidents`, 
                        `${item.payload.product_name} (${name})`
                      ]}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar dataKey="stockout_incidents" name="Out of Stock" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="low_stock_incidents" name="Low Stock" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Category Fill Rates & Stock Share */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
              <div className="mb-4">
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <PieIcon className="w-4 h-4 text-sky-500" /> Category Inventory Volume & Fill Rates
                </h3>
                <p className="text-xs text-slate-500">Average shelf capacity utilized per merchandise department</p>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={invAnalytics?.categoryDistribution || []}
                    margin={{ top: 10, right: 30, left: 20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" unit="%" domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#334155' }} width={110} />
                    <Tooltip 
                      formatter={(val: any, name: any, item: any) => [
                        `${val}% Fill (${item.payload.total_units} total units)`,
                        item.payload.name
                      ]}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                    />
                    <Bar dataKey="avg_fill_rate" name="Average Fill Rate" fill="#0284c7" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Row 2: Shelf Fill Rates Table */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
            <h3 className="font-bold text-slate-900 text-base mb-1">Shelf Fill Performance Leaderboard</h3>
            <p className="text-xs text-slate-500 mb-4">Real-time capacity analysis sorted from lowest to highest stock levels</p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Shelf</th>
                    <th className="py-2.5 px-3">Product</th>
                    <th className="py-2.5 px-3">Current Fill</th>
                    <th className="py-2.5 px-3">Units in Stock</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invAnalytics?.shelfFillRates.map((s: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-semibold text-slate-800">{s.shelf_name}</td>
                      <td className="py-2 px-3 text-slate-600">{s.product_name}</td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                s.fill_percentage === 0
                                  ? 'bg-rose-500'
                                  : s.fill_percentage < 30
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${s.fill_percentage}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs font-bold text-slate-700">{s.fill_percentage}%</span>
                        </div>
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-slate-800">
                        {s.quantity} / {s.capacity}
                      </td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          s.status === 'OUT_OF_STOCK'
                            ? 'bg-rose-50 text-rose-700'
                            : s.status === 'LOW_STOCK'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
