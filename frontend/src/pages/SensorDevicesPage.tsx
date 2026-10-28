import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { 
  Cpu, 
  Radio, 
  Scale, 
  Clock, 
  Send, 
  FileCode, 
  CheckCircle, 
  AlertCircle, 
  Layers, 
  RefreshCw,
  Terminal,
  Activity
} from 'lucide-react';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { api } from '../api/client';
import { Sensor, SensorReading } from '../types';

export const SensorDevicesPage: React.FC = () => {
  const { showToast } = useOutletContext<{ showToast: (msg: string, type?: string) => void }>();
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedSensor, setSelectedSensor] = useState<Sensor | null>(null);
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [readingsLoading, setReadingsLoading] = useState<boolean>(false);

  // Modals
  const [testModalOpen, setTestModalOpen] = useState<boolean>(false);
  const [hardwareModalOpen, setHardwareModalOpen] = useState<boolean>(false);
  const [testWeight, setTestWeight] = useState<number>(1200);
  const [testSource, setTestSource] = useState<'SIMULATED' | 'HARDWARE'>('SIMULATED');
  const [testKey, setTestKey] = useState<string>('smart_retail_esp32_secret_token_2026');

  const fetchSensors = useCallback(async () => {
    try {
      const data = await api.getSensors();
      setSensors(data);
      if (!selectedSensor && data.length > 0) {
        setSelectedSensor(data[0]);
      }
    } catch (err: any) {
      showToast('Error loading sensors: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedSensor, showToast]);

  useEffect(() => {
    fetchSensors();
    const interval = setInterval(fetchSensors, 4000);
    return () => clearInterval(interval);
  }, [fetchSensors]);

  // Load readings when selected sensor changes
  useEffect(() => {
    if (selectedSensor) {
      setReadingsLoading(true);
      api.getSensorReadings(selectedSensor.id, 30)
        .then(res => setReadings(res))
        .catch(err => console.error(err))
        .finally(() => setReadingsLoading(false));
    }
  }, [selectedSensor]);

  const handleSendTestReading = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSensor) return;

    try {
      await api.postReading({
        sensorId: selectedSensor.id,
        weightGrams: testWeight,
        source: testSource
      }, testSource === 'HARDWARE' ? testKey : undefined);

      showToast(`Telemetry reading (${testWeight}g) ingested for ${selectedSensor.id}!`);
      setTestModalOpen(false);
      fetchSensors();
      const updatedReadings = await api.getSensorReadings(selectedSensor.id, 30);
      setReadings(updatedReadings);
    } catch (err: any) {
      showToast('Ingestion failed: ' + err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Sensor Devices & Telemetry Gateway</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Monitor load-cell node connectivity, heartbeat intervals, and real-time weight ingestion.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setHardwareModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-xs transition-colors"
          >
            <FileCode className="w-3.5 h-3.5 text-sky-600" /> ESP32 Hardware Guide
          </button>
          <button
            onClick={() => setTestModalOpen(true)}
            disabled={!selectedSensor}
            className="flex items-center gap-1.5 px-3 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm shadow-sky-600/20 transition-colors"
          >
            <Send className="w-3.5 h-3.5" /> Inject Telemetry Packet
          </button>
        </div>
      </div>

      {/* Main Grid: Sensors List on Left, Live Telemetry Stream on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Sensors List Cards */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="font-bold text-slate-800 text-sm">Registered Sensors ({sensors.length})</h3>
            <span className="text-[11px] text-slate-400">Click to view telemetry</span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-400">Loading sensor devices...</div>
          ) : (
            <div className="space-y-2.5 max-h-[75vh] overflow-y-auto pr-1">
              {sensors.map((sensor) => {
                const isSelected = selectedSensor?.id === sensor.id;
                const isOnline = sensor.connection_status === 'ONLINE';

                return (
                  <div
                    key={sensor.id}
                    onClick={() => setSelectedSensor(sensor)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-sky-50/70 border-sky-300 ring-2 ring-sky-500/20 shadow-sm'
                        : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900 text-sm">{sensor.id}</span>
                          <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                            {sensor.data_source}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-slate-700">{sensor.shelf_name || 'Unassigned Shelf'}</p>
                        {sensor.product_name && (
                          <p className="text-[11px] text-slate-500 truncate max-w-[200px]">
                            {sensor.product_name}
                          </p>
                        )}
                      </div>
                      <Badge status={sensor.connection_status} size="sm" />
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                      <span className="font-mono">
                        Weight: <b className="text-slate-800">{sensor.latest_gross_weight ? `${sensor.latest_gross_weight}g` : '0g'}</b>
                      </span>
                      <span>
                        Timeout: <b>{sensor.offline_timeout_sec}s</b>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Selected Sensor Detailed Inspection & Stream */}
        <div className="lg:col-span-2 space-y-5">
          {selectedSensor ? (
            <>
              {/* Detailed Specs Banner */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-200">
                      <Cpu className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                        {selectedSensor.id}
                        <span className="text-xs font-mono font-normal text-slate-400">({selectedSensor.sensor_type})</span>
                      </h3>
                      <p className="text-xs text-slate-500">
                        Assigned to {selectedSensor.shelf_name || 'No Shelf'} • {selectedSensor.shelf_location || 'N/A'}
                      </p>
                    </div>
                  </div>
                  <Badge status={selectedSensor.connection_status} size="md" />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl text-xs">
                  <div>
                    <span className="text-slate-400">Reporting Interval</span>
                    <p className="font-bold text-slate-800">{selectedSensor.reporting_interval_sec} seconds</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Offline Timeout</span>
                    <p className="font-bold text-slate-800">{selectedSensor.offline_timeout_sec} seconds</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Data Origin</span>
                    <p className="font-bold text-slate-800">{selectedSensor.data_source}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Last Telemetry</span>
                    <p className="font-bold text-slate-800">
                      {selectedSensor.last_seen_at ? new Date(selectedSensor.last_seen_at).toLocaleTimeString() : 'Never'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Time-Series Readings Table */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <Activity className="w-4 h-4 text-sky-500" /> Incoming Telemetry Logs ({readings.length})
                    </h4>
                    <p className="text-xs text-slate-500">Live time-series gross weight measurements received from this sensor</p>
                  </div>
                  <button
                    onClick={() => {
                      if (selectedSensor) {
                        api.getSensorReadings(selectedSensor.id, 30).then(res => setReadings(res));
                      }
                    }}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                    title="Refresh Readings"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="border border-slate-100 rounded-xl overflow-hidden max-h-96 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">Receipt Time</th>
                        <th className="py-2.5 px-3">Gross Weight</th>
                        <th className="py-2.5 px-3">Origin</th>
                        <th className="py-2.5 px-3">Validity</th>
                        <th className="py-2.5 px-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {readingsLoading ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-slate-400">Loading readings...</td>
                        </tr>
                      ) : readings.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-slate-400">No telemetry readings recorded for this device yet.</td>
                        </tr>
                      ) : (
                        readings.map((r) => (
                          <tr key={r.id} className="hover:bg-slate-50/70 font-mono text-[11px]">
                            <td className="py-2 px-3 text-slate-600">
                              {new Date(r.server_receipt_timestamp).toLocaleTimeString()}
                            </td>
                            <td className="py-2 px-3 font-bold text-slate-900">
                              {r.gross_weight_grams} g
                            </td>
                            <td className="py-2 px-3">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-sans font-bold ${
                                r.source === 'HARDWARE' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                              }`}>
                                {r.source}
                              </span>
                            </td>
                            <td className="py-2 px-3">
                              {r.is_valid ? (
                                <span className="text-emerald-600 font-sans font-semibold">Valid</span>
                              ) : (
                                <span className="text-rose-600 font-sans font-semibold">Abnormal</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-slate-400 font-sans text-[11px]">
                              {r.notes || 'OK'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-2xl p-12 text-center text-slate-400 border border-slate-200">
              Select a sensor device from the left panel to inspect its configuration and telemetry logs.
            </div>
          )}
        </div>
      </div>

      {/* Manual Telemetry Injection Modal */}
      <Modal isOpen={testModalOpen} onClose={() => setTestModalOpen(false)} title={`Inject Telemetry Packet: ${selectedSensor?.id}`}>
        <form onSubmit={handleSendTestReading} className="space-y-4 text-xs">
          <div className="bg-slate-50 p-3 rounded-xl text-xs space-y-1">
            <p className="text-slate-500">Target Sensor: <b className="text-slate-800">{selectedSensor?.id}</b></p>
            <p className="text-slate-500">Shelf: <b className="text-slate-800">{selectedSensor?.shelf_name || 'N/A'}</b></p>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Measured Gross Weight (grams) *</label>
            <input
              type="number"
              step="0.1"
              required
              value={testWeight}
              onChange={(e) => setTestWeight(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-sky-500 font-mono font-bold text-base"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Telemetry Origin</label>
            <select
              value={testSource}
              onChange={(e) => setTestSource(e.target.value as any)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-sky-500 font-semibold"
            >
              <option value="SIMULATED">SIMULATED (Internal software simulator)</option>
              <option value="HARDWARE">HARDWARE (ESP32 physical node emulation)</option>
            </select>
          </div>

          {testSource === 'HARDWARE' && (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">X-Sensor-Key Device Secret Token *</label>
              <input
                type="text"
                required
                value={testKey}
                onChange={(e) => setTestKey(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-sky-500 font-mono text-xs"
              />
              <p className="text-[10px] text-slate-400 mt-1">Must match registered HARDWARE_SENSOR_SECRET in backend</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setTestModalOpen(false)}
              className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" /> Dispatch Telemetry
            </button>
          </div>
        </form>
      </Modal>

      {/* Hardware Integration Modal */}
      <Modal isOpen={hardwareModalOpen} onClose={() => setHardwareModalOpen(false)} title="ESP32 + HX711 Hardware Integration Blueprint" maxWidth="2xl">
        <div className="space-y-4 text-xs text-slate-600">
          <p>
            The backend exposes a hardware-ready endpoint at <code className="bg-slate-100 px-1.5 py-0.5 rounded text-sky-700 font-bold">POST /api/sensors/readings</code> authenticated via header <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono">X-Sensor-Key</code>.
          </p>

          <div className="bg-slate-900 text-slate-200 p-4 rounded-xl font-mono text-[11px] space-y-1">
            <p className="text-cyan-400 font-bold">// Pin Wiring Table</p>
            <p>ESP32 GPIO 16 (RX2)  &rarr;  HX711 DOUT (Data Output)</p>
            <p>ESP32 GPIO 4  (D4)   &rarr;  HX711 SCK  (Clock)</p>
            <p>ESP32 3V3 / 5V       &rarr;  HX711 VCC</p>
            <p>ESP32 GND            &rarr;  HX711 GND</p>
            <p className="text-cyan-400 font-bold mt-2">// Strain-Gauge Load Cell Wiring</p>
            <p>Red: E+ | Black: E- | White: A- | Green: A+</p>
          </div>

          <div>
            <h5 className="font-bold text-slate-800 mb-1">Example HTTP Ingestion Request (cURL)</h5>
            <pre className="bg-slate-100 p-3 rounded-xl overflow-x-auto text-[11px] font-mono text-slate-800">
{`curl -X POST http://localhost:5000/api/sensors/readings \\
  -H "Content-Type: application/json" \\
  -H "X-Sensor-Key: smart_retail_esp32_secret_token_2026" \\
  -d '{
    "sensorId": "SEN-001",
    "weightGrams": 2050.0,
    "source": "HARDWARE"
  }'`}
            </pre>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => setHardwareModalOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl"
            >
              Close Guide
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
