-- Smart-Retail Shelf Sensor Network Database Schema
-- Compatible with SQLite3

PRAGMA foreign_keys = ON;

-- 1. Products Table
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sku TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    description TEXT,
    unit_weight_grams REAL NOT NULL CHECK(unit_weight_grams > 0),
    shelf_id TEXT,
    capacity INTEGER NOT NULL DEFAULT 20 CHECK(capacity > 0),
    low_stock_threshold INTEGER NOT NULL DEFAULT 5 CHECK(low_stock_threshold >= 0),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (shelf_id) REFERENCES shelves(id) ON DELETE SET NULL
);

-- 2. Shelves Table
CREATE TABLE IF NOT EXISTS shelves (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    tare_weight_grams REAL NOT NULL DEFAULT 0.0 CHECK(tare_weight_grams >= 0),
    max_capacity_items INTEGER NOT NULL DEFAULT 20 CHECK(max_capacity_items > 0),
    current_product_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (current_product_id) REFERENCES products(id) ON DELETE SET NULL
);

-- 3. Sensors Table
CREATE TABLE IF NOT EXISTS sensors (
    id TEXT PRIMARY KEY,
    shelf_id TEXT,
    sensor_type TEXT NOT NULL DEFAULT 'HX711_LOAD_CELL',
    connection_status TEXT NOT NULL DEFAULT 'ONLINE' CHECK(connection_status IN ('ONLINE', 'OFFLINE', 'ERROR')),
    last_seen_at TEXT,
    reporting_interval_sec INTEGER NOT NULL DEFAULT 5 CHECK(reporting_interval_sec > 0),
    offline_timeout_sec INTEGER NOT NULL DEFAULT 15 CHECK(offline_timeout_sec > 0),
    data_source TEXT NOT NULL DEFAULT 'SIMULATED' CHECK(data_source IN ('SIMULATED', 'HARDWARE')),
    device_token TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (shelf_id) REFERENCES shelves(id) ON DELETE SET NULL
);

-- 4. Inventory Table
CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id TEXT NOT NULL,
    shelf_id TEXT NOT NULL,
    current_gross_weight REAL NOT NULL DEFAULT 0.0,
    current_net_weight REAL NOT NULL DEFAULT 0.0,
    estimated_quantity INTEGER NOT NULL DEFAULT 0 CHECK(estimated_quantity >= 0),
    stock_percentage REAL NOT NULL DEFAULT 0.0,
    stock_status TEXT NOT NULL DEFAULT 'OUT_OF_STOCK' CHECK(stock_status IN ('IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'UNKNOWN')),
    last_calculated_at TEXT NOT NULL,
    UNIQUE(product_id, shelf_id),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (shelf_id) REFERENCES shelves(id) ON DELETE CASCADE
);

-- 5. Sensor Readings Table (Time-Series Log)
CREATE TABLE IF NOT EXISTS sensor_readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sensor_id TEXT NOT NULL,
    shelf_id TEXT,
    gross_weight_grams REAL NOT NULL,
    reading_timestamp TEXT NOT NULL,
    server_receipt_timestamp TEXT NOT NULL,
    source TEXT NOT NULL CHECK(source IN ('SIMULATED', 'HARDWARE')),
    is_valid INTEGER NOT NULL DEFAULT 1 CHECK(is_valid IN (0, 1)),
    notes TEXT,
    FOREIGN KEY (sensor_id) REFERENCES sensors(id) ON DELETE CASCADE,
    FOREIGN KEY (shelf_id) REFERENCES shelves(id) ON DELETE SET NULL
);

-- 6. Alerts Table
CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    alert_type TEXT NOT NULL CHECK(alert_type IN ('LOW_STOCK', 'OUT_OF_STOCK', 'SENSOR_OFFLINE', 'ABNORMAL_READING')),
    severity TEXT NOT NULL CHECK(severity IN ('INFO', 'WARNING', 'CRITICAL')),
    shelf_id TEXT,
    product_id TEXT,
    sensor_id TEXT,
    description TEXT NOT NULL,
    acknowledged INTEGER NOT NULL DEFAULT 0 CHECK(acknowledged IN (0, 1)),
    acknowledged_at TEXT,
    acknowledged_by TEXT,
    resolved INTEGER NOT NULL DEFAULT 0 CHECK(resolved IN (0, 1)),
    resolved_at TEXT,
    resolution_notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (shelf_id) REFERENCES shelves(id) ON DELETE SET NULL,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
    FOREIGN KEY (sensor_id) REFERENCES sensors(id) ON DELETE SET NULL
);

-- 7. Stock Movements Table
CREATE TABLE IF NOT EXISTS stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id TEXT NOT NULL,
    shelf_id TEXT NOT NULL,
    movement_type TEXT NOT NULL CHECK(movement_type IN ('RESTOCK', 'CONSUMPTION', 'MANUAL_ADJUSTMENT', 'AUDIT')),
    quantity_delta INTEGER NOT NULL,
    previous_quantity INTEGER NOT NULL,
    new_quantity INTEGER NOT NULL,
    previous_weight REAL,
    new_weight REAL,
    reason TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (shelf_id) REFERENCES shelves(id) ON DELETE CASCADE
);

-- 8. System Settings Table
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TEXT NOT NULL
);

-- Indexes for performant lookup and queries
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_shelf ON products(shelf_id);
CREATE INDEX IF NOT EXISTS idx_shelves_product ON shelves(current_product_id);
CREATE INDEX IF NOT EXISTS idx_sensors_shelf ON sensors(shelf_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_shelf ON inventory(shelf_id);
CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory(stock_status);
CREATE INDEX IF NOT EXISTS idx_readings_sensor_time ON sensor_readings(sensor_id, server_receipt_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_readings_shelf_time ON sensor_readings(shelf_id, server_receipt_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(resolved, acknowledged, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_shelf ON alerts(shelf_id);
CREATE INDEX IF NOT EXISTS idx_movements_prod_time ON stock_movements(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_movements_shelf_time ON stock_movements(shelf_id, created_at DESC);
