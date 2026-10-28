import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { 
  Package, 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  Eye, 
  Scale, 
  AlertTriangle,
  Layers,
  Barcode
} from 'lucide-react';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { api } from '../api/client';
import { Product, Shelf } from '../types';

export const ProductManagementPage: React.FC = () => {
  const { showToast } = useOutletContext<{ showToast: (msg: string, type?: string) => void }>();
  const [products, setProducts] = useState<Product[]>([]);
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modals
  const [addModalOpen, setAddModalOpen] = useState<boolean>(false);
  const [editModalOpen, setEditModalOpen] = useState<boolean>(false);
  const [detailModalOpen, setDetailModalOpen] = useState<boolean>(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const [formData, setFormData] = useState({
    id: '',
    name: '',
    sku: '',
    category: 'Bakery & Snacks',
    description: '',
    unit_weight_grams: 100,
    shelf_id: '',
    capacity: 20,
    low_stock_threshold: 5
  });

  const fetchData = useCallback(async () => {
    try {
      const [prods, shs] = await Promise.all([
        api.getProducts({
          search: search || undefined,
          category: categoryFilter !== 'ALL' ? categoryFilter : undefined,
          status: statusFilter !== 'ALL' ? statusFilter : undefined
        }),
        api.getShelves()
      ]);
      setProducts(prods);
      setShelves(shs);
    } catch (err: any) {
      showToast('Error loading products: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter, statusFilter, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const categories = ['ALL', 'Bakery & Snacks', 'Dairy & Refrigerated', 'Beverages & Juices', 'Pantry & Canned Goods'];

  const handleOpenAdd = () => {
    setFormData({
      id: '',
      name: '',
      sku: '',
      category: 'Bakery & Snacks',
      description: '',
      unit_weight_grams: 100,
      shelf_id: '',
      capacity: 20,
      low_stock_threshold: 5
    });
    setAddModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setFormData({
      id: p.id,
      name: p.name,
      sku: p.sku,
      category: p.category,
      description: p.description || '',
      unit_weight_grams: p.unit_weight_grams,
      shelf_id: p.shelf_id || '',
      capacity: p.capacity,
      low_stock_threshold: p.low_stock_threshold
    });
    setEditModalOpen(true);
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createProduct({
        ...formData,
        shelf_id: formData.shelf_id ? formData.shelf_id : null
      });
      showToast('Product added successfully!');
      setAddModalOpen(false);
      fetchData();
    } catch (err: any) {
      showToast('Create failed: ' + err.message, 'error');
    }
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.updateProduct(formData.id, {
        ...formData,
        shelf_id: formData.shelf_id ? formData.shelf_id : null
      });
      showToast('Product updated successfully!');
      setEditModalOpen(false);
      fetchData();
    } catch (err: any) {
      showToast('Update failed: ' + err.message, 'error');
    }
  };

  const handleDeleteProduct = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete '${name}'?`)) return;
    try {
      await api.deleteProduct(id);
      showToast(`Product '${name}' removed.`);
      fetchData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Product Catalog & Calibration</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage product weights, shelf assignments, and low-stock alert thresholds.
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-1.5 px-3 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-semibold shadow-sm shadow-sky-600/20 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add New Product
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, SKU, or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
          />
        </div>
        <div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                Category: {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
          >
            <option value="ALL">All Stock Statuses</option>
            <option value="IN_STOCK">In Stock</option>
            <option value="LOW_STOCK">Low Stock</option>
            <option value="OUT_OF_STOCK">Out of Stock</option>
            <option value="UNKNOWN">Unknown / Unassigned</option>
          </select>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Product & SKU</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Calibrated Unit Weight</th>
                <th className="py-3 px-4">Assigned Shelf</th>
                <th className="py-3 px-4">Current Stock</th>
                <th className="py-3 px-4">Alert Threshold</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">Loading catalog...</td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">No products found matching criteria.</td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div>
                        <span className="font-bold text-slate-900 text-sm">{p.name}</span>
                        <div className="flex items-center gap-2 mt-0.5 text-slate-400">
                          <span className="font-mono text-[11px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded flex items-center gap-1">
                            <Barcode className="w-3 h-3" /> {p.sku}
                          </span>
                          <span className="text-[11px]">• {p.id}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{p.category}</td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">
                      {p.unit_weight_grams} g
                    </td>
                    <td className="py-3 px-4">
                      {p.shelf_name ? (
                        <div>
                          <span className="font-semibold text-sky-700">{p.shelf_name}</span>
                          <p className="text-[10px] text-slate-400">{p.shelf_location}</p>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {p.estimated_quantity !== undefined ? (
                        <span className="font-bold text-slate-900">
                          {p.estimated_quantity} <span className="text-slate-400 font-normal">/ {p.capacity}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400">N/A</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-amber-700">
                      ≤ {p.low_stock_threshold} units
                    </td>
                    <td className="py-3 px-4">
                      <Badge status={p.stock_status || 'UNKNOWN'} size="sm" />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setSelectedProduct(p);
                            setDetailModalOpen(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(p)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Edit Product"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(p.id, p.name)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete Product"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* Add Product Modal */}
      <Modal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)} title="Add Product to Catalog">
        <form onSubmit={handleCreateProduct} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Product Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Organic Almond Butter"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-sky-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">SKU / Barcode *</label>
              <input
                type="text"
                required
                placeholder="e.g. BUT-014"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-sky-500 font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Category *</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-sky-500"
              >
                {categories.filter(c => c !== 'ALL').map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Unit Weight (grams) *</label>
              <input
                type="number"
                min="1"
                step="0.1"
                required
                value={formData.unit_weight_grams}
                onChange={(e) => setFormData({ ...formData, unit_weight_grams: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-sky-500 font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Shelf Capacity</label>
              <input
                type="number"
                min="1"
                required
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value, 10) || 20 })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Low Stock Thresh</label>
              <input
                type="number"
                min="0"
                required
                value={formData.low_stock_threshold}
                onChange={(e) => setFormData({ ...formData, low_stock_threshold: parseInt(e.target.value, 10) || 5 })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Assign to Shelf Bay</label>
            <select
              value={formData.shelf_id}
              onChange={(e) => setFormData({ ...formData, shelf_id: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-sky-500"
            >
              <option value="">None (Unassigned catalog item)</option>
              {shelves.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id}: {s.name} ({s.location})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Package size, dietary notes, etc."
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-sky-500"
            />
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
              Add Product
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Product Modal */}
      <Modal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} title={`Edit Product: ${formData.name}`}>
        <form onSubmit={handleUpdateProduct} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Product Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-sky-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">SKU / Barcode *</label>
              <input
                type="text"
                required
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-sky-500 font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Category *</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-sky-500"
              >
                {categories.filter(c => c !== 'ALL').map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Unit Weight (grams) *</label>
              <input
                type="number"
                min="1"
                step="0.1"
                required
                value={formData.unit_weight_grams}
                onChange={(e) => setFormData({ ...formData, unit_weight_grams: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-sky-500 font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Shelf Capacity</label>
              <input
                type="number"
                min="1"
                required
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value, 10) || 20 })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Low Stock Thresh</label>
              <input
                type="number"
                min="0"
                required
                value={formData.low_stock_threshold}
                onChange={(e) => setFormData({ ...formData, low_stock_threshold: parseInt(e.target.value, 10) || 5 })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Assign to Shelf Bay</label>
            <select
              value={formData.shelf_id}
              onChange={(e) => setFormData({ ...formData, shelf_id: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-1 focus:ring-sky-500"
            >
              <option value="">None (Unassigned catalog item)</option>
              {shelves.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id}: {s.name} ({s.location})
                </option>
              ))}
            </select>
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

      {/* Product Details Modal */}
      <Modal isOpen={detailModalOpen} onClose={() => setDetailModalOpen(false)} title={`Product Details: ${selectedProduct?.name}`}>
        {selectedProduct && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl">
              <div>
                <span className="text-slate-400">Product ID</span>
                <p className="font-mono font-bold text-slate-800">{selectedProduct.id}</p>
              </div>
              <div>
                <span className="text-slate-400">SKU / Barcode</span>
                <p className="font-mono font-bold text-slate-800">{selectedProduct.sku}</p>
              </div>
              <div>
                <span className="text-slate-400">Category</span>
                <p className="font-semibold text-slate-800">{selectedProduct.category}</p>
              </div>
              <div>
                <span className="text-slate-400">Unit Weight</span>
                <p className="font-bold text-slate-800">{selectedProduct.unit_weight_grams} g</p>
              </div>
              <div>
                <span className="text-slate-400">Assigned Shelf</span>
                <p className="font-semibold text-slate-800">{selectedProduct.shelf_name || 'None'}</p>
              </div>
              <div>
                <span className="text-slate-400">Shelf Capacity</span>
                <p className="font-semibold text-slate-800">{selectedProduct.capacity} items</p>
              </div>
            </div>
            {selectedProduct.description && (
              <div>
                <span className="text-slate-400 font-semibold">Description</span>
                <p className="mt-1 text-slate-600 bg-white p-3 rounded-xl border border-slate-200">
                  {selectedProduct.description}
                </p>
              </div>
            )}
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setDetailModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
