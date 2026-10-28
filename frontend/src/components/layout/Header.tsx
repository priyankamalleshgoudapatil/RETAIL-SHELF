import React from 'react';
import { 
  Play, 
  Square, 
  RotateCcw, 
  Activity, 
  Sparkles,
  Zap
} from 'lucide-react';
import { SimulationStatus } from '../../types';

interface HeaderProps {
  simulationStatus?: SimulationStatus | null;
  onStartSimulation: (scenario?: string) => void;
  onStopSimulation: () => void;
  onSelectScenario: (scenario: string) => void;
  onResetDemo: () => void;
  storeName?: string;
  isBackendHealthy: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  simulationStatus,
  onStartSimulation,
  onStopSimulation,
  onSelectScenario,
  onResetDemo,
  storeName = 'Metro Fresh Supermarket',
  isBackendHealthy,
}) => {
  const isActive = simulationStatus?.isActive ?? false;
  const currentScenario = simulationStatus?.scenario ?? 'NORMAL';

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between z-20 shadow-sm shrink-0">
      {/* Store & Connectivity */}
      <div className="flex items-center gap-4">
        <div>
          <h2 className="text-sm font-bold text-slate-800 leading-tight">{storeName}</h2>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  isBackendHealthy ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                }`}
              />
              <span className="text-[11px] font-medium text-slate-600">
                {isBackendHealthy ? 'Backend API Online' : 'Connecting to API...'}
              </span>
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-[11px] text-slate-500">Node + SQLite + HX711</span>
          </div>
        </div>
      </div>

      {/* Simulator Controls & Demo Badge */}
      <div className="flex items-center gap-3">
        {/* Clearly visible Demo / Simulation Mode Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-purple-600 animate-spin" style={{ animationDuration: '6s' }} />
          <span className="text-xs font-bold text-purple-800 tracking-wide">
            SIMULATION MODE:
          </span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            isActive ? 'bg-purple-600 text-white shadow-xs' : 'bg-slate-200 text-slate-700'
          }`}>
            {isActive ? 'ACTIVE' : 'IDLE'}
          </span>
        </div>

        {/* Scenario Selector */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <label className="text-[11px] font-medium text-slate-500 pl-2 pr-1 flex items-center gap-1">
            <Zap className="w-3 h-3 text-amber-500" /> Scenario:
          </label>
          <select
            value={currentScenario}
            onChange={(e) => onSelectScenario(e.target.value)}
            className="text-xs font-medium bg-white text-slate-700 rounded-lg px-2.5 py-1 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            <option value="NORMAL">Normal Shopping</option>
            <option value="RUSH_HOUR">Rush Hour Depletion</option>
            <option value="RESTOCK_RUN">Restocking Run</option>
            <option value="SENSOR_DISCONNECT">Sensor Disconnect</option>
          </select>
        </div>

        {/* Start / Stop Toggle */}
        {isActive ? (
          <button
            onClick={onStopSimulation}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-xl text-xs font-semibold transition-all shadow-xs"
          >
            <Square className="w-3.5 h-3.5 fill-rose-600" />
            Pause
          </button>
        ) : (
          <button
            onClick={() => onStartSimulation()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl text-xs font-semibold transition-all shadow-sm shadow-emerald-600/20"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            Start Simulation
          </button>
        )}

        {/* Reset Dataset Button */}
        <button
          onClick={onResetDemo}
          title="Reset database to initial presentation seed state"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium border border-slate-200 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset Demo
        </button>
      </div>
    </header>
  );
};
