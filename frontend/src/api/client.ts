import { 
  Product, Shelf, Sensor, InventoryItem, SensorReading, Alert, 
  StockMovement, DashboardSummary, SimulationStatus 
} from '../types';

const API_BASE = '/api';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, { ...options, headers });
  const data: ApiResponse<T> = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(data.error || data.message || `Request failed with status ${res.status}`);
  }

  return data.data;
}

export const api = {
  // System Health
  getHealth: () => request<{ status: string; database: string; uptimeSeconds: number }>('/health'),

  // Dashboard
  getDashboardSummary: () => request<DashboardSummary>('/dashboard/summary'),

  // Products
  getProducts: (params?: { search?: string; category?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.category) q.set('category', params.category);
    if (params?.status) q.set('status', params.status);
    const qs = q.toString();
    return request<Product[]>(`/products${qs ? `?${qs}` : ''}`);
  },
  getProductById: (id: string) => request<Product & { recent_movements: StockMovement[] }>(`/products/${id}`),
  createProduct: (data: Partial<Product>) => request<Product>('/products', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateProduct: (id: string, data: Partial<Product>) => request<Product>(`/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  deleteProduct: (id: string) => request<{ message: string }>(`/products/${id}`, {
    method: 'DELETE'
  }),

  // Shelves
  getShelves: (params?: { search?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.status) q.set('status', params.status);
    const qs = q.toString();
    return request<Shelf[]>(`/shelves${qs ? `?${qs}` : ''}`);
  },
  getShelfById: (id: string) => request<Shelf & { recent_readings: SensorReading[]; active_alerts: Alert[] }>(`/shelves/${id}`),
  createShelf: (data: Partial<Shelf>) => request<Shelf>('/shelves', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateShelf: (id: string, data: Partial<Shelf>) => request<Shelf>(`/shelves/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  deleteShelf: (id: string) => request<{ message: string }>(`/shelves/${id}`, {
    method: 'DELETE'
  }),

  // Inventory & Restocking
  getInventory: () => request<InventoryItem[]>('/inventory'),
  restock: (data: { shelfId: string; productId: string; quantityToAdd: number; reason?: string; notes?: string; performedBy?: string }) => 
    request<{ inventory: InventoryItem; movement: StockMovement }>('/inventory/restock', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  adjustStock: (data: { shelfId: string; productId: string; newQuantity: number; reason: string; notes?: string; adjustedBy?: string }) => 
    request<{ inventory: InventoryItem; movement: StockMovement }>('/inventory/adjust', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  getMovements: (params?: { productId?: string; shelfId?: string; type?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.productId) q.set('productId', params.productId);
    if (params?.shelfId) q.set('shelfId', params.shelfId);
    if (params?.type) q.set('type', params.type);
    if (params?.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return request<StockMovement[]>(`/inventory/movements${qs ? `?${qs}` : ''}`);
  },
  getInventoryExportUrl: () => `${API_BASE}/inventory/export`,
  getMovementsExportUrl: () => `${API_BASE}/inventory/movements/export`,

  // Sensors & Readings
  getSensors: () => request<Sensor[]>('/sensors'),
  getSensorById: (id: string) => request<Sensor & { recent_readings: SensorReading[] }>(`/sensors/${id}`),
  getSensorReadings: (id: string, limit: number = 50) => request<SensorReading[]>(`/sensors/${id}/readings?limit=${limit}`),
  postReading: (data: { sensorId: string; weightGrams: number; source: 'SIMULATED' | 'HARDWARE' }, secretKey?: string) => {
    const headers: Record<string, string> = {};
    if (secretKey) {
      headers['X-Sensor-Key'] = secretKey;
    }
    return request<any>('/sensors/readings', {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
  },

  // Alerts
  getAlerts: (params?: { resolved?: boolean; severity?: string; type?: string; shelfId?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.resolved !== undefined) q.set('resolved', String(params.resolved));
    if (params?.severity) q.set('severity', params.severity);
    if (params?.type) q.set('type', params.type);
    if (params?.shelfId) q.set('shelfId', params.shelfId);
    if (params?.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return request<Alert[]>(`/alerts${qs ? `?${qs}` : ''}`);
  },
  acknowledgeAlert: (id: string, acknowledgedBy?: string) => request<any>(`/alerts/${id}/acknowledge`, {
    method: 'POST',
    body: JSON.stringify({ acknowledgedBy: acknowledgedBy || 'Store Staff' })
  }),
  resolveAlert: (id: string, resolutionNotes: string) => request<any>(`/alerts/${id}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ resolutionNotes })
  }),

  // Analytics
  getInventoryAnalytics: () => request<{
    statusDistribution: Array<{ name: string; value: number; percentage: number }>;
    categoryDistribution: Array<{ name: string; product_count: number; total_units: number; avg_fill_rate: number }>;
    incidentFrequency: Array<{ product_name: string; sku: string; low_stock_incidents: number; stockout_incidents: number; total_incidents: number }>;
    sensorHealth: Array<{ status: string; count: number; source: string }>;
    shelfFillRates: Array<{ shelf_name: string; product_name: string; fill_percentage: number; quantity: number; capacity: number; status: string }>;
  }>('/analytics/inventory'),
  getRestockingAnalytics: () => request<{
    restockVelocity: Array<{ date: string; restock_operations: number; units_restocked: number; customer_pickups: number; units_consumed: number }>;
    topRestockedProducts: Array<{ product_name: string; sku: string; restock_events: number; total_units_replenished: number }>;
  }>('/analytics/restocking'),
  getAnalyticsExportUrl: () => `${API_BASE}/analytics/export`,

  // Simulation
  getSimulationStatus: () => request<SimulationStatus>('/simulation/status'),
  startSimulation: (scenario: string = 'NORMAL', intervalMs: number = 4000) => request<SimulationStatus>('/simulation/start', {
    method: 'POST',
    body: JSON.stringify({ scenario, intervalMs })
  }),
  stopSimulation: () => request<SimulationStatus>('/simulation/stop', {
    method: 'POST'
  }),
  setSimulationScenario: (scenario: string) => request<SimulationStatus>('/simulation/scenario', {
    method: 'POST',
    body: JSON.stringify({ scenario })
  }),
  resetSimulation: () => request<SimulationStatus>('/simulation/reset', {
    method: 'POST'
  }),

  // Settings
  getSettings: () => request<{ settings: Record<string, string>; definitions: any[] }>('/settings'),
  updateSettings: (settings: Record<string, string>) => request<Record<string, string>>('/settings', {
    method: 'PUT',
    body: JSON.stringify(settings)
  })
};
