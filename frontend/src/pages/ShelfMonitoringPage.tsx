import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { 
  Layers, 
  Search, 
  Plus, 
  Cpu, 
  Scale, 
  AlertTriangle, 
  Clock, 
  Eye, 
  Edit3, 
  Trash2,
  RefreshCw,
  Box
} from 'lucide-react';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { api } from '../api/client';
import { Shelf, SensorReading, Alert } from '../types';

export const ShelfMonitoringPage: React.FC = () => {
  const { showToast } = useOutletContext<{ showToast: (msg: string, type?: string) => void }>();
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modal states
  const [detailModalOpen, setDetailModalOpen] = useState<boolean>(false);
  const [selectedShelf, setSelectedShelf] = useState<(Shelf & { recent_readings?: SensorReading[]; active_alerts?: Alert[] }) | null>(null);
  
  const [addModalOpen, setAddModalOpen] = useState<boolean>(false);
  const [editModalOpen, setEditModalOpen] = useState<boolean>(false);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    location: '',
    tare_weight_grams: 250,
    max_capacity_items: 20
  });

  const fetchShelves = useCallback(async () => {
    try {
      const data = await api.getShelves({
        search: search || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined
      });
      setShelves(data);
    } catch (err: any) {
      showToast('Error fetching shelves: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, showToast]);

  useEffect(() => {
    fetchShelves();
    const interval = setInterval(fetchShelves, 4000);
    return () => clearInterval(interval);
  }, [fetchShelves]);

  const handleOpenDetails = async (shelf: Shelf) => {
    try {
      const details = await api.getShelfById(shelf.id);
      setSelectedShelf(details);
      setDetailModalOpen(true);
    } catch (err: any) {
      showToast('Failed to load shelf details: ' + err.message, 'error');
    }
  };

  const handleOpenEdit = (shelf: Shelf) => {
    setFormData({
      id: shelf.id,
      name: shelf.name,
      location: shelf.location,
      tare_weight_grams: shelf.tare_weight_grams,
      max_capacity_items: shelf.max_capacity_items
    });
    setEditModalOpen(true);
  };

  const handleCreateShelf = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createShelf(formData);
      showToast(`Shelf ${formData.id || ''} created successfully!`);
      setAddModalOpen(false);
      setFormData({ id: '', name: '', location: '', tare_weight_grams: 250, max_capacity_items: 20 });
      fetchShelves();
    } catch (err: any) {
      showToast('Create failed: ' + err.message, 'error');
    }
  };

  const handleUpdateShelf = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.updateShelf(formData.id, formData);
      showToast(`Shelf ${formData.id} updated!`);
      setEditModalOpen(false);
      fetchShelves();
    } catch (err: any) {
      showToast('Update failed: ' + err.message, 'error');
    }
  };

  const handleDeleteShelf = async (id: string) => {
    if (!window.confirm(`Are you sure you want to delete shelf ${id}?`)) return;
    try {
      await api.deleteShelf(id);
      showToast(`Shelf ${id} deleted.`);
      fetchShelves();
    } catch (err: any) {
      showToast('Delete failed: ' + err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Shelf Monitoring Network</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Physical bay telemetry, load-cell calibration, and real-time stock levels.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setFormData({ id: '', name: '', location: '', tare_weight_grams: 250, max_capacity_items: 20 });
              setAddModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-semibold shadow-sm shadow-sky-600/20 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Shelf Bay
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by shelf ID, location, or product name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
          >
            <option value="ALL">All Stock Statuses</option>
            <option value="IN_STOCK">In Stock</option>
            <option value="LOW_STOCK">Low Stock</option>
            <option value="OUT_OF_STOCK">Out of Stock</option>
            <option value="UNKNOWN">Unknown / Offline</option>
          </select>
        </div>
      </div>

      {/* Shelf Matrix Grid */}
      {loading ? (
        <div className="p-12 text-center text-slate-400">Loading shelf network...</div>
      ) : shelves.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 text-slate-400">
          No shelf bays matched your search criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {shelves.map((shelf) => {
            const isOffline = shelf.sensor_status !== 'ONLINE';
            const percentage = shelf.stock_percentage ?? 0;
            const quantity = shelf.estimated_quantity ?? 0;
            const capacity = shelf.max_capacity_items;

            return (
              <div
                key={shelf.id}
                className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm card-hover flex flex-col justify-between"
              >
                <div>
                  {/* Card Header: ID & Status */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="space-y-0.5">
                      <span className="font-mono text-xs font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">
                        {shelf.id}
                      </span>
                      <h4 className="font-bold text-slate-900 text-sm mt-1">{shelf.name}</h4>
                      <p className="text-xs text-slate-500">{shelf.location}</p>
                    </div>
                    <Badge status={isOffline ? 'OFFLINE' : shelf.stock_status} size="sm" />
                  </div>

                  {/* Product Assignment Box */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 my-3">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Box className="w-3 h-3 text-slate-500" /> Assigned Product
                    </p>
                    {shelf.product_name ? (
                      <div>
                        <p className="text-xs font-bold text-slate-800 line-clamp-1">{shelf.product_name}</p>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                          <span>Unit: <b>{shelf.unit_weight_grams}g</b></span>
                          <span>•</span>
                          <span>Threshold: <b>{shelf.low_stock_threshold}</b></span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">No product assigned</span>
                    )}
                  </div>

                  {/* Stock Quantity Progress Bar */}
                  <div className="space-y-1.5 my-3">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-600">Inventory Level</span>
                      <span className="text-slate-900 font-bold">
                        {quantity} <span className="text-slate-400 font-normal">/ {capacity} units</span>
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          shelf.stock_status === 'OUT_OF_STOCK'
                            ? 'bg-rose-500'
                            : shelf.stock_status === 'LOW_STOCK'
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>{percentage}% fill</span>
                      <span>Gross: {shelf.current_gross_weight ? Math.round(shelf.current_gross_weight) : 0}g</span>
                    </div>
                  </div>

                  {/* Sensor Hardware Health */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-mono text-[11px]">{shelf.sensor_id || 'No Sensor'}</span>
                    </div>
                    <span className="text-[11px]">Tare: {shelf.tare_weight_grams}g</span>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="pt-3 border-t border-slate-100 mt-3 flex items-center justify-between">
                  <button
                    onClick={() => handleOpenDetails(shelf)}
                    className="flex items-center gap-1 text-xs font-semibold text-sky-600 hover:text-sky-700"
                  >
                    <Eye className="w-3.5 h-3.5" /> Details & Telemetry
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(shelf)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Edit Shelf Specs"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteShelf(shelf.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Delete Shelf"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Shelf Details Modal */}
      <Modal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title={`Shelf Details: ${selectedShelf?.id} (${selectedShelf?.name})`}
        maxWidth="xl"
      >
        {selectedShelf && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl text-xs">
              <div>
                <span className="text-slate-400">Location</span>
                <p className="font-semibold text-slate-800">{selectedShelf.location}</p>
              </div>
              <div>
                <span className="text-slate-400">Tare Weight</span>
                <p className="font-semibold text-slate-800">{selectedShelf.tare_weight_grams} g</p>
              </div>
              <div>
                <span className="text-slate-400">Max Capacity</span>
                <p className="font-semibold text-slate-800">{selectedShelf.max_capacity_items} items</p>
              </div>
              <div>
                <span className="text-slate-400">Assigned Product</span>
                <p className="font-semibold text-slate-800">{selectedShelf.product_name || 'None'}</p>
              </div>
              <div>
                <span className="text-slate-400">Unit Weight</span>
                <p className="font-semibold text-slate-800">{selectedShelf.unit_weight_grams || 0} g</p>
              </div>
              <div>
                <span className="text-slate-400">Stock Status</span>
                <div className="mt-0.5">
                  <Badge status={selectedShelf.stock_status} size="sm" />
                </div>
              </div>
            </div>

            {/* Recent Sensor Telemetry Readings */}
            <div>
              <h4 className="font-bold text-slate-900 text-sm mb-2 flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-sky-500" /> Recent Sensor Telemetry Logs
              </h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">Timestamp</th>
                      <th className="py-2 px-3">Gross Weight</th>
                      <th className="py-2 px-3">Source</th>
                      <th className="py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {selectedShelf.recent_readings && selectedShelf.recent_readings.length > 0 ? (
                      selectedShelf.recent_readings.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <td className="py-1.5 px-3">{new Date(r.server_receipt_timestamp).toLocaleTimeString()}</td>
                          <td className="py-1.5 px-3 font-bold text-slate-800">{r.gross_weight_grams}g</td>
                          <td className="py-1.5 px-3">
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{r.source}</span>
                          </td>
                          <td className="py-1.5 px-3">
                            <span className="text-emerald-600">Valid</span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-slate-400">No recent telemetry logs available</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setDetailModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add Shelf Modal */}
      <Modal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)} title="Register New Shelf Bay">
        <form onSubmit={handleCreateShelf} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Shelf ID (Optional, e.g. SH-009)</label>
            <input
              type="text"
              placeholder="Auto-generated if blank"
              value={formData.id}
              onChange={(e) => setFormData({ ...formData, id: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-sky-500"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Shelf Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Shelf F1 - Breakfast Cereals"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-sky-500"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Location Details *</label>
            <input
              type="text"
              required
              placeholder="e.g. Aisle 4 - Bay F - Tier 1"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-sky-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Platform Tare Weight (grams)</label>
              <input
                type="number"
                min="0"
                step="1"
                required
                value={formData.tare_weight_grams}
                onChange={(e) => setFormData({ ...formData, tare_weight_grams: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Max Capacity (items)</label>
              <input
                type="number"
                min="1"
                step="1"
                required
                value={formData.max_capacity_items}
                onChange={(e) => setFormData({ ...formData, max_capacity_items: parseInt(e.target.value, 10) || 20 })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setAddModalOpen(false)}
              className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl"
            >
              Create Shelf
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Shelf Modal */}
      <Modal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} title={`Edit Shelf ${formData.id}`}>
        <form onSubmit={handleUpdateShelf} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Shelf Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-sky-500"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Location Details *</label>
            <input
              type="text"
              required
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-sky-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Platform Tare Weight (grams)</label>
              <input
                type="number"
                min="0"
                step="1"
                required
                value={formData.tare_weight_grams}
                onChange={(e) => setFormData({ ...formData, tare_weight_grams: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Max Capacity (items)</label>
              <input
                type="number"
                min="1"
                step="1"
                required
                value={formData.max_capacity_items}
                onChange={(e) => setFormData({ ...formData, max_capacity_items: parseInt(e.target.value, 10) || 20 })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setEditModalOpen(false)}
              className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl"
            >
              Save Changes
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
