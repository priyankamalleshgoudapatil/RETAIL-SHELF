import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { 
  Package, 
  Layers, 
  Cpu, 
  BellRing, 
  AlertTriangle, 
  ArrowRight,
  TrendingUp,
  Activity,
  History,
  CheckCircle2,
  AlertCircle,
  RefreshCw
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
  Cell 
} from 'recharts';
import { StatCard } from '../components/common/StatCard';
import { Badge } from '../components/common/Badge';
import { api } from '../api/client';
import { DashboardSummary } from '../types';

export const DashboardPage: React.FC = () => {
  const { showToast } = useOutletContext<{ showToast: (msg: string, type?: string) => void }>();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const fetchSummary = useCallback(async (isManual: boolean = false) => {
    if (isManual) setRefreshing(true);
    try {
      const data = await api.getDashboardSummary();
      setSummary(data);
    } catch (err: any) {
      if (isManual) showToast('Failed to load dashboard data: ' + err.message, 'error');
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchSummary();
    const timer = setInterval(() => fetchSummary(false), 3500);
    return () => clearInterval(timer);
  }, [fetchSummary]);

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-500 font-medium">Loading real-time shelf sensor dashboard...</p>
        </div>
      </div>
    );
  }

  // Stock status pie data
  const pieData = [
    { name: 'In Stock', value: summary?.inStockShelves || 0, color: '#10b981' },
    { name: 'Low Stock', value: summary?.lowStockShelves || 0, color: '#f59e0b' },
    { name: 'Out of Stock', value: summary?.outOfStockShelves || 0, color: '#ef4444' },
    { name: 'Unknown / Stale', value: summary?.unknownShelves || 0, color: '#94a3b8' },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Top Banner / Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Real-Time Inventory Overview</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Autonomous shelf sensor telemetry, live weight estimation, and restocking triggers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchSummary(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-xs transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link
            to="/inventory"
            className="flex items-center gap-1.5 px-3 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-semibold shadow-sm shadow-sky-600/20 transition-colors"
          >
            Restock Shelves
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Products"
          value={summary?.totalProducts ?? 0}
          subtitle={`${summary?.totalShelves ?? 0} active shelf bays`}
          icon={<Package className="w-5 h-5 text-sky-600" />}
          color="blue"
        />
        <StatCard
          title="Shelves In Stock"
          value={summary?.inStockShelves ?? 0}
          subtitle={`${summary?.lowStockShelves ?? 0} low stock / ${summary?.outOfStockShelves ?? 0} empty`}
          icon={<Layers className="w-5 h-5 text-emerald-600" />}
          color="emerald"
          trend={{ value: `${Math.round(((summary?.inStockShelves || 0) / (summary?.totalShelves || 1)) * 100)}% Fill`, isPositive: true }}
        />
        <StatCard
          title="Sensors Status"
          value={`${summary?.onlineSensors ?? 0} Online`}
          subtitle={`${summary?.offlineSensors ?? 0} offline / timeout`}
          icon={<Cpu className="w-5 h-5 text-purple-600" />}
          color={summary?.offlineSensors && summary.offlineSensors > 0 ? 'amber' : 'purple'}
        />
        <StatCard
          title="Active Alerts"
          value={summary?.activeAlertsCount ?? 0}
          subtitle={`${summary?.criticalAlerts.length ?? 0} requiring urgent response`}
          icon={<BellRing className="w-5 h-5 text-rose-600" />}
          color={summary?.activeAlertsCount && summary.activeAlertsCount > 0 ? 'rose' : 'slate'}
        />
      </div>

      {/* Main Charts & Status Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Fill Rates by Shelf Bay */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Shelf Fill Rate Distribution</h3>
              <p className="text-xs text-slate-500">Live stock percentages derived from load cell gross weights</p>
            </div>
            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
              <TrendingUp className="w-3.5 h-3.5" /> Live Sensor Feeds
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={summary?.urgentRestocking.map(u => ({
                  name: u.shelfId,
                  percentage: u.stockPercentage,
                  quantity: u.currentQuantity,
                  capacity: u.capacity,
                  product: u.productName
                })) || []}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis unit="%" tick={{ fontSize: 11, fill: '#64748b' }} domain={[0, 100]} />
                <Tooltip 
                  formatter={(val: any, name: any, item: any) => [
                    `${val}% (${item.payload.quantity}/${item.payload.capacity} units)`, 
                    item.payload.product
                  ]}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar 
                  dataKey="percentage" 
                  fill="#0284c7" 
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Inventory Stock Breakdown Donut */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Stock Condition Breakdown</h3>
            <p className="text-xs text-slate-500 mb-4">Across all {summary?.totalShelves} monitored shelves</p>
            
            <div className="h-44 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-slate-600">In Stock: <b>{summary?.inStockShelves}</b></span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
              <span className="text-slate-600">Low: <b>{summary?.lowStockShelves}</b></span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
              <span className="text-slate-600">Out: <b>{summary?.outOfStockShelves}</b></span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0" />
              <span className="text-slate-600">Offline: <b>{summary?.offlineSensors}</b></span>
            </div>
          </div>
        </div>
      </div>

      {/* Urgent Restocking & Live Activity Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Urgent Restocking List */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500" /> Products Requiring Urgent Restocking
              </h3>
              <p className="text-xs text-slate-500">Shelves currently below low-stock threshold or empty</p>
            </div>
            <Link to="/inventory" className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1">
              Restock All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {summary?.urgentRestocking.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm flex flex-col items-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
              All shelves are sufficiently stocked!
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {summary?.urgentRestocking.map((item) => (
                <div key={item.shelfId} className="py-3 flex items-center justify-between hover:bg-slate-50/80 px-2 rounded-xl transition-colors">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-900">{item.productName}</span>
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{item.sku}</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {item.shelfName} • {item.shelfLocation}
                    </p>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-800">
                        {item.currentQuantity} <span className="text-xs font-normal text-slate-400">/ {item.capacity}</span>
                      </p>
                      <Badge status={item.status} size="sm" />
                    </div>
                    <Link
                      to="/inventory"
                      className="px-2.5 py-1 text-xs font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg transition-colors border border-sky-200"
                    >
                      Restock
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Telemetry & Activity Feed */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Activity className="w-4 h-4 text-sky-500" /> Recent Sensor Telemetry & Movements
              </h3>
              <p className="text-xs text-slate-500">Real-time incoming weight packets and stock changes</p>
            </div>
            <Link to="/sensors" className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1">
              View Sensors <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {summary?.recentReadings.map((reading) => (
              <div key={reading.id} className="py-2.5 flex items-center justify-between text-xs hover:bg-slate-50/80 px-2 rounded-xl transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 font-mono text-[10px] font-bold">
                    {reading.sensor_id.slice(-3)}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-800">{reading.sensor_id}</span>
                    <span className="text-slate-400 mx-1">•</span>
                    <span className="text-slate-500">{reading.shelf_name || 'Shelf ' + reading.shelf_id}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-slate-800">{reading.gross_weight_grams.toLocaleString()}g</span>
                  <p className="text-[10px] text-slate-400">
                    {new Date(reading.server_receipt_timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
