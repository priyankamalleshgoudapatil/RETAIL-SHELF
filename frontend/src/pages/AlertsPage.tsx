import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { 
  BellRing, 
  CheckCircle2, 
  AlertTriangle, 
  AlertOctagon, 
  Clock, 
  Check, 
  ShieldCheck, 
  Filter,
  User,
  MessageSquare
} from 'lucide-react';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { api } from '../api/client';
import { Alert } from '../types';

export const AlertsPage: React.FC = () => {
  const { showToast, refreshGlobal } = useOutletContext<{ showToast: (msg: string, type?: string) => void; refreshGlobal?: () => void }>();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [resolvedFilter, setResolvedFilter] = useState<string>('unresolved');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');

  // Modals
  const [resolveModalOpen, setResolveModalOpen] = useState<boolean>(false);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState<string>('Restocked shelf and confirmed load cell weight.');

  const fetchAlerts = useCallback(async () => {
    try {
      const data = await api.getAlerts({
        resolved: resolvedFilter === 'all' ? undefined : (resolvedFilter === 'resolved'),
        severity: severityFilter !== 'ALL' ? severityFilter : undefined
      });
      setAlerts(data);
    } catch (err: any) {
      showToast('Error loading alerts: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [resolvedFilter, severityFilter, showToast]);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 3500);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  const handleAcknowledge = async (alertId: string) => {
    try {
      await api.acknowledgeAlert(alertId, 'Floor Supervisor');
      showToast('Alert acknowledged');
      fetchAlerts();
      if (refreshGlobal) refreshGlobal();
    } catch (err: any) {
      showToast('Acknowledge failed: ' + err.message, 'error');
    }
  };

  const handleOpenResolve = (alert: Alert) => {
    setSelectedAlert(alert);
    setResolutionNotes(
      alert.alert_type === 'OUT_OF_STOCK' || alert.alert_type === 'LOW_STOCK'
        ? 'Restocked shelf bay and verified sensor telemetry.'
        : 'Inspected sensor node physical wiring and connection restored.'
    );
    setResolveModalOpen(true);
  };

  const handleConfirmResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAlert) return;

    try {
      await api.resolveAlert(selectedAlert.id, resolutionNotes);
      showToast('Alert resolved successfully!');
      setResolveModalOpen(false);
      fetchAlerts();
      if (refreshGlobal) refreshGlobal();
    } catch (err: any) {
      showToast('Resolve failed: ' + err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Alerts & Escalation Center</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Automated stockout alerts, low-stock warnings, sensor timeout triggers, and staff action audits.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 pl-1">
          <Filter className="w-4 h-4 text-slate-400" /> Filter:
        </div>

        <div className="flex items-center gap-2 flex-1">
          <select
            value={resolvedFilter}
            onChange={(e) => setResolvedFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            <option value="unresolved">Active Alerts Only</option>
            <option value="resolved">Resolved Alerts History</option>
            <option value="all">All Alerts</option>
          </select>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical Severity</option>
            <option value="WARNING">Warning Severity</option>
            <option value="INFO">Info Severity</option>
          </select>
        </div>

        <span className="text-xs text-slate-400 font-medium">
          Showing <b>{alerts.length}</b> alert events
        </span>
      </div>

      {/* Alerts Feed List */}
      {loading ? (
        <div className="p-12 text-center text-slate-400">Loading alerts feed...</div>
      ) : alerts.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 text-slate-400">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
          <p className="font-semibold text-slate-700 text-sm">No alerts matching filter criteria</p>
          <p className="text-xs text-slate-400 mt-1">All retail shelves and sensors are currently operating smoothly.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const isResolved = alert.resolved === 1;
            const isCritical = alert.severity === 'CRITICAL';

            return (
              <div
                key={alert.id}
                className={`bg-white rounded-2xl p-5 border transition-all ${
                  isResolved
                    ? 'border-slate-200/80 opacity-75'
                    : isCritical
                    ? 'border-rose-300 ring-1 ring-rose-400/20 shadow-sm'
                    : 'border-amber-200 shadow-xs'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge status={alert.severity} size="sm" />
                      <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {alert.id}
                      </span>
                      <span className="text-xs font-semibold text-slate-700">
                        {alert.alert_type.replace(/_/g, ' ')}
                      </span>
                      {isResolved && (
                        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5" /> Resolved
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 leading-snug">
                      {alert.description}
                    </h4>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-1">
                      {alert.shelf_name && (
                        <span>
                          Shelf: <b>{alert.shelf_name}</b> ({alert.shelf_id})
                        </span>
                      )}
                      {alert.product_name && (
                        <span>
                          Product: <b>{alert.product_name}</b>
                        </span>
                      )}
                      <span>
                        Created: <b>{new Date(alert.created_at).toLocaleTimeString()}</b>
                      </span>
                    </div>

                    {/* Acknowledgement and Resolution Status Footprint */}
                    <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 pt-2 border-t border-slate-100 mt-2">
                      {alert.acknowledged === 1 ? (
                        <span className="text-sky-700 flex items-center gap-1">
                          <Check className="w-3 h-3" /> Acknowledged by {alert.acknowledged_by || 'Staff'} ({new Date(alert.acknowledged_at || '').toLocaleTimeString()})
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Unacknowledged</span>
                      )}

                      {alert.resolved === 1 && alert.resolution_notes && (
                        <span className="text-emerald-700 flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" /> Note: {alert.resolution_notes}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions Column */}
                  {!isResolved && (
                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      {alert.acknowledged === 0 && (
                        <button
                          onClick={() => handleAcknowledge(alert.id)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
                        >
                          Acknowledge
                        </button>
                      )}
                      <button
                        onClick={() => handleOpenResolve(alert)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
                      >
                        Resolve Alert
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Resolve Alert Modal */}
      <Modal isOpen={resolveModalOpen} onClose={() => setResolveModalOpen(false)} title="Record Alert Resolution">
        <form onSubmit={handleConfirmResolve} className="space-y-4 text-xs">
          <div className="bg-slate-50 p-3 rounded-xl space-y-1">
            <p className="font-semibold text-slate-800">{selectedAlert?.description}</p>
            <p className="text-slate-400 text-[11px]">Alert ID: {selectedAlert?.id}</p>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Resolution Action / Notes *</label>
            <textarea
              rows={3}
              required
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="e.g. Added 15 biscuit units, calibrated tare, verified scale reading."
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setResolveModalOpen(false)}
              className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl"
            >
              Confirm Resolution
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
