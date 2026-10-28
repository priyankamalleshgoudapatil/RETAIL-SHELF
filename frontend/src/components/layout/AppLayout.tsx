import React, { useState, useEffect, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { api } from '../../api/client';
import { SimulationStatus } from '../../types';

export const AppLayout: React.FC = () => {
  const [simulationStatus, setSimulationStatus] = useState<SimulationStatus | null>(null);
  const [isBackendHealthy, setIsBackendHealthy] = useState<boolean>(true);
  const [activeAlertsCount, setActiveAlertsCount] = useState<number>(0);
  const [storeName, setStoreName] = useState<string>('Metro Fresh Supermarket');
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = useCallback((text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  }, []);

  const fetchGlobalState = useCallback(async () => {
    try {
      const [health, sim, alerts, settings] = await Promise.all([
        api.getHealth(),
        api.getSimulationStatus(),
        api.getAlerts({ resolved: false }),
        api.getSettings(),
      ]);

      setIsBackendHealthy(health.status === 'UP');
      setSimulationStatus(sim);
      setActiveAlertsCount(alerts.length);
      if (settings.settings.store_name) {
        setStoreName(settings.settings.store_name);
      }
    } catch (err) {
      setIsBackendHealthy(false);
    }
  }, []);

  // Poll status every 4 seconds to sync live simulation events
  useEffect(() => {
    fetchGlobalState();
    const interval = setInterval(fetchGlobalState, 4000);
    return () => clearInterval(interval);
  }, [fetchGlobalState]);

  const handleStartSimulation = async (scenario?: string) => {
    try {
      const res = await api.startSimulation(scenario || 'NORMAL');
      setSimulationStatus(res);
      showToast(`Simulation started (${res.scenario} scenario)`);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleStopSimulation = async () => {
    try {
      const res = await api.stopSimulation();
      setSimulationStatus(res);
      showToast('Simulation paused');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleSelectScenario = async (scenario: string) => {
    try {
      const res = await api.setSimulationScenario(scenario);
      setSimulationStatus(res);
      showToast(`Switched scenario to ${scenario}`);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleResetDemo = async () => {
    if (!window.confirm('Reset database to baseline presentation state? All test changes will revert to original seed data.')) {
      return;
    }
    try {
      const res = await api.resetSimulation();
      setSimulationStatus(res);
      showToast('Demo dataset reset to initial state!');
      await fetchGlobalState();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 animate-slideDown">
          <div
            className={`px-4 py-2.5 rounded-xl shadow-lg border text-sm font-medium flex items-center gap-2 ${
              toastMessage.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : toastMessage.type === 'info'
                ? 'bg-sky-50 border-sky-200 text-sky-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Main Sidebar */}
      <Sidebar activeAlertsCount={activeAlertsCount} />

      {/* Right Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          simulationStatus={simulationStatus}
          onStartSimulation={handleStartSimulation}
          onStopSimulation={handleStopSimulation}
          onSelectScenario={handleSelectScenario}
          onResetDemo={handleResetDemo}
          storeName={storeName}
          isBackendHealthy={isBackendHealthy}
        />

        <main className="flex-1 overflow-y-auto p-6 bg-slate-50">
          <div className="max-w-7xl mx-auto">
            <Outlet context={{ showToast, refreshGlobal: fetchGlobalState }} />
          </div>
        </main>
      </div>
    </div>
  );
};
