import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Layers, 
  Package, 
  Boxes, 
  Cpu, 
  BellRing, 
  BarChart3, 
  Settings,
  ShoppingBag,
  Radio
} from 'lucide-react';

interface SidebarProps {
  activeAlertsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeAlertsCount = 0 }) => {
  const navItems = [
    { to: '/', label: 'Overview Dashboard', icon: LayoutDashboard },
    { to: '/shelves', label: 'Shelf Monitoring', icon: Layers },
    { to: '/products', label: 'Product Catalog', icon: Package },
    { to: '/inventory', label: 'Inventory & Restock', icon: Boxes },
    { to: '/sensors', label: 'Sensor Devices', icon: Cpu },
    { 
      to: '/alerts', 
      label: 'Alerts & Actions', 
      icon: BellRing, 
      badge: activeAlertsCount > 0 ? activeAlertsCount : undefined 
    },
    { to: '/analytics', label: 'Analytics & Reports', icon: BarChart3 },
    { to: '/settings', label: 'System Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800 select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 gap-3 border-b border-slate-800 bg-slate-950/40">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-400 flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
          <ShoppingBag className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-bold text-white tracking-tight text-sm">Smart-Retail</h1>
          <p className="text-[10px] text-cyan-400 font-medium tracking-wide flex items-center gap-1">
            <Radio className="w-3 h-3 animate-pulse" /> SENSOR NETWORK
          </p>
        </div>
      </div>

      {/* Nav Menu */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          Management
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30 font-semibold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`
              }
            >
              <div className="flex items-center gap-3">
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-rose-500 text-white animate-pulse">
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* College Project Badge Footer */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/40">
        <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
          <p className="text-xs font-semibold text-white">Student Project Edition</p>
          <p className="text-[11px] text-slate-400 mt-0.5">ESP32 + HX711 Load Cell Telemetry & Restock Alerts</p>
        </div>
      </div>
    </aside>
  );
};
