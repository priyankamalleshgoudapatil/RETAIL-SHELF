export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'UNKNOWN';
export type SensorStatus = 'ONLINE' | 'OFFLINE' | 'ERROR';
export type DataSource = 'SIMULATED' | 'HARDWARE';
export type AlertType = 'LOW_STOCK' | 'OUT_OF_STOCK' | 'SENSOR_OFFLINE' | 'ABNORMAL_READING';
export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type MovementType = 'RESTOCK' | 'CONSUMPTION' | 'MANUAL_ADJUSTMENT' | 'AUDIT';

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  description?: string;
  unit_weight_grams: number;
  shelf_id?: string | null;
  capacity: number;
  low_stock_threshold: number;
  created_at: string;
  updated_at: string;
  // Joined fields
  shelf_name?: string;
  shelf_location?: string;
  estimated_quantity?: number;
  current_gross_weight?: number;
  stock_percentage?: number;
  stock_status?: StockStatus;
  sensor_id?: string;
  sensor_status?: SensorStatus;
}

export interface Shelf {
  id: string;
  name: string;
  location: string;
  tare_weight_grams: number;
  max_capacity_items: number;
  current_product_id?: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  product_id?: string;
  product_name?: string;
  product_sku?: string;
  unit_weight_grams?: number;
  low_stock_threshold?: number;
  estimated_quantity?: number;
  current_gross_weight?: number;
  current_net_weight?: number;
  stock_percentage?: number;
  stock_status?: StockStatus;
  sensor_id?: string;
  sensor_type?: string;
  sensor_status?: SensorStatus;
  sensor_source?: DataSource;
  sensor_last_seen?: string;
}

export interface Sensor {
  id: string;
  shelf_id?: string | null;
  sensor_type: string;
  connection_status: SensorStatus;
  last_seen_at?: string | null;
  reporting_interval_sec: number;
  offline_timeout_sec: number;
  data_source: DataSource;
  device_token?: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  shelf_name?: string;
  shelf_location?: string;
  product_name?: string;
  product_sku?: string;
  latest_gross_weight?: number;
  latest_reading_time?: string;
}

export interface InventoryItem {
  id: number;
  product_id: string;
  shelf_id: string;
  current_gross_weight: number;
  current_net_weight: number;
  estimated_quantity: number;
  stock_percentage: number;
  stock_status: StockStatus;
  last_calculated_at: string;
  // Joined fields
  product_name: string;
  product_sku: string;
  product_category: string;
  unit_weight_grams: number;
  product_capacity: number;
  low_stock_threshold: number;
  shelf_name: string;
  shelf_location: string;
  tare_weight_grams: number;
  sensor_id?: string;
  sensor_status?: SensorStatus;
}

export interface SensorReading {
  id: number;
  sensor_id: string;
  shelf_id?: string | null;
  shelf_name?: string;
  gross_weight_grams: number;
  reading_timestamp: string;
  server_receipt_timestamp: string;
  source: DataSource;
  is_valid: number;
  notes?: string | null;
  sensor_type?: string;
}

export interface Alert {
  id: string;
  alert_type: AlertType;
  severity: AlertSeverity;
  shelf_id?: string | null;
  product_id?: string | null;
  sensor_id?: string | null;
  description: string;
  acknowledged: number;
  acknowledged_at?: string | null;
  acknowledged_by?: string | null;
  resolved: number;
  resolved_at?: string | null;
  resolution_notes?: string | null;
  created_at: string;
  updated_at: string;
  product_name?: string;
  product_sku?: string;
  shelf_name?: string;
  shelf_location?: string;
}

export interface StockMovement {
  id: number;
  product_id: string;
  shelf_id: string;
  movement_type: MovementType;
  quantity_delta: number;
  previous_quantity: number;
  new_quantity: number;
  previous_weight?: number | null;
  new_weight?: number | null;
  reason: string;
  notes?: string | null;
  created_at: string;
  product_name?: string;
  product_sku?: string;
  shelf_name?: string;
}

export interface DashboardSummary {
  totalProducts: number;
  totalShelves: number;
  onlineSensors: number;
  offlineSensors: number;
  inStockShelves: number;
  lowStockShelves: number;
  outOfStockShelves: number;
  unknownShelves: number;
  activeAlertsCount: number;
  isSimulationActive: boolean;
  activeScenario: 'NORMAL' | 'RUSH_HOUR' | 'RESTOCK_RUN' | 'SENSOR_DISCONNECT';
  criticalAlerts: Alert[];
  urgentRestocking: Array<{
    productId: string;
    productName: string;
    sku: string;
    shelfId: string;
    shelfName: string;
    shelfLocation: string;
    currentQuantity: number;
    capacity: number;
    threshold: number;
    stockPercentage: number;
    status: StockStatus;
  }>;
  recentMovements: StockMovement[];
  recentReadings: SensorReading[];
  inventoryHistory: Array<{
    time_label: string;
    restock_count: number;
    consumption_count: number;
    avg_quantity: number;
  }>;
}

export interface SimulationStatus {
  isActive: boolean;
  scenario: 'NORMAL' | 'RUSH_HOUR' | 'RESTOCK_RUN' | 'SENSOR_DISCONNECT';
  tickIntervalMs: number;
  lastTickAt: string | null;
  totalTicks: number;
}
