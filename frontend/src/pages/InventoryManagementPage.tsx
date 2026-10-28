import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { 
  Boxes, 
  ArrowUpRight, 
  Sliders, 
  Download, 
  History, 
  Search, 
  Clock, 
  ArrowDownLeft, 
  CheckCircle,
  FileSpreadsheet,
  AlertTriangle
} from 'lucide-react';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { api } from '../api/client';
import { InventoryItem, StockMovement } from '../types';

export const InventoryManagementPage: React.FC = () => {
  const { showToast } = useOutletContext<{ showToast: (msg: string, type?: string) => void }>();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'STOCK' | 'MOVEMENTS'>('STOCK');

  // Modals
  const [restockModalOpen, setRestockModalOpen] = useState<boolean>(false);
  const [adjustModalOpen, setAdjustModalOpen] = useState<boolean>(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  const [restockQty, setRestockQty] = useState<number>(10);
  const [restockReason, setRestockReason] = useState<string>('Standard inventory replenishment');
  const [restockNotes, setRestockNotes] = useState<string>('');
  const [operatorName, setOperatorName] = useState<string>('Staff Associate');

  const [adjustQty, setAdjustQty] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>('Inventory count audit correction');
  const [adjustNotes, setAdjustNotes] = useState<string>('');

  const fetchData = useCallback(async () => {
    try {
      const [inv, movs] = await Promise.all([
        api.getInventory(),
        api.getMovements({ limit: 100 })
      ]);
      setInventory(inv);
      setMovements(movs);
    } catch (err: any) {
      showToast('Error loading inventory: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleOpenRestock = (item: InventoryItem) => {
    setSelectedItem(item);
    const needed = (item.product_capacity || 20) - item.estimated_quantity;
    setRestockQty(needed > 0 ? needed : 5);
    setRestockReason('Standard inventory replenishment');
    setRestockNotes('');
    setRestockModalOpen(true);
  };

  const handleOpenAdjust = (item: InventoryItem) => {
    setSelectedItem(item);
    setAdjustQty(item.estimated_quantity);
    setAdjustReason('Physical shelf inventory audit');
    setAdjustNotes('');
    setAdjustModalOpen(true);
  };

  const submitRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    try {
      await api.restock({
        shelfId: selectedItem.shelf_id,
        productId: selectedItem.product_id,
        quantityToAdd: restockQty,
        reason: restockReason,
        notes: restockNotes,
        performedBy: operatorName
      });
      showToast(`Restocked ${restockQty} units of ${selectedItem.product_name}!`);
      setRestockModalOpen(false);
      fetchData();
    } catch (err: any) {
      showToast('Restock failed: ' + err.message, 'error');
    }
  };

  const submitAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    try {
      await api.adjustStock({
        shelfId: selectedItem.shelf_id,
        productId: selectedItem.product_id,
        newQuantity: adjustQty,
        reason: adjustReason,
        notes: adjustNotes,
        adjustedBy: operatorName
      });
      showToast(`Stock adjusted to ${adjustQty} units.`);
      setAdjustModalOpen(false);
      fetchData();
    } catch (err: any) {
      showToast('Adjustment failed: ' + err.message, 'error');
    }
  };

  const filteredInventory = inventory.filter(item =>
    item.product_name.toLowerCase().includes(search.toLowerCase()) ||
    item.product_sku.toLowerCase().includes(search.toLowerCase()) ||
    item.shelf_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Inventory & Restocking Engine</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time shelf product counts, manual stock audits, restocking transactions, and audit logs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={api.getInventoryExportUrl()}
            download
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-xs transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Export Inventory CSV
          </a>
          <a
            href={api.getMovementsExportUrl()}
            download
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-sky-600" /> Export Movements CSV
          </a>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('STOCK')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'STOCK'
                ? 'bg-sky-600 text-white shadow-sm shadow-sky-600/30'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            Current Shelf Inventory ({inventory.length})
          </button>
          <button
            onClick={() => setActiveTab('MOVEMENTS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'MOVEMENTS'
                ? 'bg-sky-600 text-white shadow-sm shadow-sky-600/30'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            Stock Movement History ({movements.length})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search items, SKUs, shelves..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>
      </div>

      {/* TAB 1: Current Inventory */}
      {activeTab === 'STOCK' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Product & Category</th>
                  <th className="py-3 px-4">Shelf Bay</th>
                  <th className="py-3 px-4">Gross / Net Weight</th>
                  <th className="py-3 px-4">Estimated Quantity</th>
                  <th className="py-3 px-4">Shelf Fill</th>
                  <th className="py-3 px-4">Condition</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">Loading inventory...</td>
                  </tr>
                ) : filteredInventory.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">No inventory found.</td>
                  </tr>
                ) : (
                  filteredInventory.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div>
                          <span className="font-bold text-slate-900 text-sm">{item.product_name}</span>
                          <div className="flex items-center gap-2 mt-0.5 text-slate-400 text-[11px]">
                            <span className="font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{item.product_sku}</span>
                            <span>• {item.product_category}</span>
                            <span>• {item.unit_weight_grams}g/unit</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800">{item.shelf_name}</span>
                        <p className="text-[10px] text-slate-400">{item.shelf_location}</p>
                      </td>
                      <td className="py-3 px-4 font-mono">
                        <div className="text-slate-800 font-bold">{Math.round(item.current_gross_weight)}g gross</div>
                        <div className="text-[10px] text-slate-400">{Math.round(item.current_net_weight)}g net</div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 text-sm">
                        {item.estimated_quantity} <span className="text-xs font-normal text-slate-400">/ {item.product_capacity}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="w-24">
                          <div className="flex justify-between text-[10px] font-bold text-slate-600 mb-0.5">
                            <span>{item.stock_percentage}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                item.stock_status === 'OUT_OF_STOCK'
                                  ? 'bg-rose-500'
                                  : item.stock_status === 'LOW_STOCK'
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(0, item.stock_percentage))}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge status={item.stock_status} size="sm" />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenRestock(item)}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" /> Restock
                          </button>
                          <button
                            onClick={() => handleOpenAdjust(item)}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                          >
                            <Sliders className="w-3.5 h-3.5" /> Adjust
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Stock Movements History */}
      {activeTab === 'MOVEMENTS' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Product & Shelf</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Delta</th>
                  <th className="py-3 px-4">Qty Progression</th>
                  <th className="py-3 px-4">Weight Shift</th>
                  <th className="py-3 px-4">Reason & Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">No stock movements recorded yet.</td>
                  </tr>
                ) : (
                  movements.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                        {new Date(m.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900">{m.product_name}</span>
                        <p className="text-[10px] text-slate-400">{m.shelf_name}</p>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                            m.movement_type === 'RESTOCK'
                              ? 'bg-emerald-50 text-emerald-700'
                              : m.movement_type === 'CONSUMPTION'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-sky-50 text-sky-700'
                          }`}
                        >
                          {m.movement_type === 'RESTOCK' && <ArrowUpRight className="w-3 h-3" />}
                          {m.movement_type === 'CONSUMPTION' && <ArrowDownLeft className="w-3 h-3" />}
                          {m.movement_type}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold">
                        <span className={m.quantity_delta > 0 ? 'text-emerald-600' : 'text-rose-600'}>
                          {m.quantity_delta > 0 ? `+${m.quantity_delta}` : m.quantity_delta}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700">
                        {m.previous_quantity} &rarr; <b>{m.new_quantity}</b> units
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                        {m.previous_weight ? Math.round(m.previous_weight) : 0}g &rarr; {m.new_weight ? Math.round(m.new_weight) : 0}g
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        <p className="font-semibold">{m.reason}</p>
                        {m.notes && <p className="text-[11px] text-slate-400">{m.notes}</p>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Restock Modal */}
      <Modal isOpen={restockModalOpen} onClose={() => setRestockModalOpen(false)} title={`Restock Shelf: ${selectedItem?.product_name}`}>
        <form onSubmit={submitRestock} className="space-y-4 text-xs">
          <div className="bg-slate-50 p-3 rounded-xl flex items-center justify-between text-xs">
            <div>
              <p className="text-slate-400">Current Stock</p>
              <p className="text-base font-bold text-slate-800">{selectedItem?.estimated_quantity} units</p>
            </div>
            <div>
              <p className="text-slate-400">Shelf Capacity</p>
              <p className="text-base font-bold text-slate-800">{selectedItem?.product_capacity} units</p>
            </div>
            <div>
              <p className="text-slate-400">Shelf Bay</p>
              <p className="text-xs font-semibold text-slate-800">{selectedItem?.shelf_id}</p>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Quantity to Restock (units) *</label>
            <input
              type="number"
              min="1"
              max={(selectedItem?.product_capacity || 20) - (selectedItem?.estimated_quantity || 0) + 10}
              required
              value={restockQty}
              onChange={(e) => setRestockQty(parseInt(e.target.value, 10) || 1)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-sky-500 text-sm font-bold"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Reason for Restocking</label>
            <input
              type="text"
              required
              value={restockReason}
              onChange={(e) => setRestockReason(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Performed By (Associate Name)</label>
            <input
              type="text"
              value={operatorName}
              onChange={(e) => setOperatorName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Additional Notes (Optional)</label>
            <textarea
              rows={2}
              value={restockNotes}
              onChange={(e) => setRestockNotes(e.target.value)}
              placeholder="Batch number, supplier box ID, etc."
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setRestockModalOpen(false)}
              className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl"
            >
              Confirm Restock
            </button>
          </div>
        </form>
      </Modal>

      {/* Adjust Modal */}
      <Modal isOpen={adjustModalOpen} onClose={() => setAdjustModalOpen(false)} title={`Manual Stock Audit: ${selectedItem?.product_name}`}>
        <form onSubmit={submitAdjust} className="space-y-4 text-xs">
          <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex items-center gap-2 text-xs text-amber-800">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>This will override the calculated inventory count and record an audit stock movement.</span>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">New Verified Quantity (units) *</label>
            <input
              type="number"
              min="0"
              max={selectedItem?.product_capacity || 30}
              required
              value={adjustQty}
              onChange={(e) => setAdjustQty(parseInt(e.target.value, 10) || 0)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-sky-500 text-sm font-bold"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Reason for Adjustment *</label>
            <input
              type="text"
              required
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Auditor / Staff Name</label>
            <input
              type="text"
              value={operatorName}
              onChange={(e) => setOperatorName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setAdjustModalOpen(false)}
              className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl"
            >
              Save Adjustment
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
