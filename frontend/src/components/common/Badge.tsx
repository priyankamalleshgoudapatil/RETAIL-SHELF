import React from 'react';
import { StockStatus, SensorStatus, AlertSeverity } from '../../types';

interface BadgeProps {
  status?: StockStatus | SensorStatus | AlertSeverity | string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  children?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({ status, size = 'md', className = '', children }) => {
  const text = children || status;

  let colorClasses = 'bg-slate-100 text-slate-700 border-slate-200';
  let dotClass = 'bg-slate-400';

  switch (status) {
    case 'IN_STOCK':
    case 'ONLINE':
    case 'NORMAL':
    case 'INFO':
      colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      dotClass = 'bg-emerald-500';
      break;
    case 'LOW_STOCK':
    case 'WARNING':
      colorClasses = 'bg-amber-50 text-amber-700 border-amber-200';
      dotClass = 'bg-amber-500';
      break;
    case 'OUT_OF_STOCK':
    case 'OFFLINE':
    case 'ERROR':
    case 'CRITICAL':
      colorClasses = 'bg-rose-50 text-rose-700 border-rose-200';
      dotClass = 'bg-rose-500';
      break;
    case 'UNKNOWN':
      colorClasses = 'bg-slate-100 text-slate-600 border-slate-200';
      dotClass = 'bg-slate-400';
      break;
    case 'SIMULATED':
      colorClasses = 'bg-purple-50 text-purple-700 border-purple-200';
      dotClass = 'bg-purple-500';
      break;
    case 'HARDWARE':
      colorClasses = 'bg-blue-50 text-blue-700 border-blue-200';
      dotClass = 'bg-blue-500';
      break;
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
    lg: 'text-sm px-3 py-1.5'
  }[size];

  return (
    <span className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${colorClasses} ${sizeClasses} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotClass} animate-pulse-subtle`} />
      {text}
    </span>
  );
};
