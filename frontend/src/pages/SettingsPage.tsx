import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { 
  Settings as SettingsIcon, 
  Save, 
  Store, 
  Cpu, 
  Key, 
  Sparkles, 
  Clock, 
  ShieldAlert,
  CheckCircle2
} from 'lucide-react';
import { api } from '../api/client';

export const SettingsPage: React.FC = () => {
  const { showToast, refreshGlobal } = useOutletContext<{ showToast: (msg: string, type?: string) => void; refreshGlobal?: () => void }>();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  const fetchSettings = useCallback(async () => {
    try {
      const data = await api.getSettings();
      setSettings(data.settings);
    } catch (err: any) {
      showToast('Error loading settings: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await api.updateSettings(settings);
      setSettings(updated);
      showToast('Settings saved successfully and applied across backend services!');
      if (refreshGlobal) refreshGlobal();
    } catch (err: any) {
      showToast('Save failed: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">System Settings & Configuration</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Configure telemetry timeouts, store identifiers, default thresholds, and hardware security credentials.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-400">Loading system settings...</div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {/* Store Identification */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-3">
              <Store className="w-4 h-4 text-sky-500" /> Store Profile & Branch
            </h3>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Store / Branch Name</label>
              <input
                type="text"
                required
                value={settings.store_name || ''}
                onChange={(e) => handleChange('store_name', e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-1 focus:ring-sky-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">Displayed in top navigation bar and generated CSV reports.</p>
            </div>
          </div>

          {/* Telemetry Timing & Offline Detection */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-3">
              <Cpu className="w-4 h-4 text-purple-500" /> Sensor Network Timing & Heartbeats
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Default Reporting Interval (seconds)</label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  required
                  value={settings.sensor_reporting_interval_sec || '5'}
                  onChange={(e) => handleChange('sensor_reporting_interval_sec', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold focus:ring-1 focus:ring-sky-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">Expected frequency of telemetry packets from scale platforms.</p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Sensor Offline Timeout (seconds)</label>
                <input
                  type="number"
                  min="5"
                  max="300"
                  required
                  value={settings.sensor_offline_timeout_sec || '15'}
                  onChange={(e) => handleChange('sensor_offline_timeout_sec', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold focus:ring-1 focus:ring-sky-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">Duration of silence before marking sensor as OFFLINE and triggering alert.</p>
              </div>
            </div>
          </div>

          {/* Stock Threshold Defaults */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-3">
              <ShieldAlert className="w-4 h-4 text-amber-500" /> Stock Alert Defaults
            </h3>
            <div className="text-xs">
              <label className="block font-semibold text-slate-700 mb-1">Default Low-Stock Threshold (units)</label>
              <input
                type="number"
                min="1"
                max="50"
                required
                value={settings.default_low_stock_threshold || '5'}
                onChange={(e) => handleChange('default_low_stock_threshold', e.target.value)}
                className="w-full max-w-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold focus:ring-1 focus:ring-sky-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">Default warning trigger for newly registered products.</p>
            </div>
          </div>

          {/* Hardware Security API Key */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-3">
              <Key className="w-4 h-4 text-emerald-500" /> Hardware Device Authentication (ESP32)
            </h3>
            <div className="text-xs">
              <label className="block font-semibold text-slate-700 mb-1">Global Hardware Ingestion Secret Key</label>
              <input
                type="text"
                required
                value={settings.hardware_api_key || ''}
                onChange={(e) => handleChange('hardware_api_key', e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:ring-1 focus:ring-sky-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Transmitted in the <code className="bg-slate-100 px-1 py-0.5 rounded text-sky-700 font-bold">X-Sensor-Key</code> HTTP header by ESP32 microcontrollers.
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-sm shadow-sky-600/30 text-xs transition-all"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
