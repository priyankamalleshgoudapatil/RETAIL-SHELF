import { getDatabase, closeDatabase } from './connection';

export function seedDatabase(force: boolean = false): void {
  const db = getDatabase();

  const count = (db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number }).count;
  if (count > 0 && !force) {
    console.log('Database already contains data. Skipping seed.');
    return;
  }

  console.log('Seeding Smart-Retail database with realistic supermarket data...');

  // Use a transaction for atomic and fast seeding
  const seedTransaction = db.transaction(() => {
    if (force) {
      db.prepare('DELETE FROM alerts').run();
      db.prepare('DELETE FROM stock_movements').run();
      db.prepare('DELETE FROM sensor_readings').run();
      db.prepare('DELETE FROM inventory').run();
      db.prepare('DELETE FROM sensors').run();
      db.prepare('DELETE FROM products').run();
      db.prepare('DELETE FROM shelves').run();
    }

    const now = new Date();
    const isoNow = now.toISOString();

    // 1. Seed Shelves (8 shelves)
    const insertShelf = db.prepare(`
      INSERT INTO shelves (id, name, location, tare_weight_grams, max_capacity_items, current_product_id, created_at, updated_at)
      VALUES (@id, @name, @location, @tare_weight_grams, @max_capacity_items, @current_product_id, @created_at, @updated_at)
    `);

    const shelves = [
      { id: 'SH-001', name: 'Shelf A1 - Biscuits & Cookies', location: 'Aisle 1 - Bay A - Tier 1', tare_weight_grams: 250, max_capacity_items: 25, current_product_id: null, created_at: isoNow, updated_at: isoNow },
      { id: 'SH-002', name: 'Shelf A2 - Gourmet Snacks', location: 'Aisle 1 - Bay A - Tier 2', tare_weight_grams: 300, max_capacity_items: 20, current_product_id: null, created_at: isoNow, updated_at: isoNow },
      { id: 'SH-003', name: 'Shelf B1 - Artisanal Bread', location: 'Aisle 1 - Bay B - Tier 1', tare_weight_grams: 400, max_capacity_items: 15, current_product_id: null, created_at: isoNow, updated_at: isoNow },
      { id: 'SH-004', name: 'Shelf C1 - Chilled Dairy Milk', location: 'Aisle 2 - Refrig C - Tier 1', tare_weight_grams: 500, max_capacity_items: 16, current_product_id: null, created_at: isoNow, updated_at: isoNow },
      { id: 'SH-005', name: 'Shelf C2 - Yogurt & Desserts', location: 'Aisle 2 - Refrig C - Tier 2', tare_weight_grams: 350, max_capacity_items: 24, current_product_id: null, created_at: isoNow, updated_at: isoNow },
      { id: 'SH-006', name: 'Shelf D1 - Cheeses & Butter', location: 'Aisle 2 - Refrig D - Tier 1', tare_weight_grams: 280, max_capacity_items: 20, current_product_id: null, created_at: isoNow, updated_at: isoNow },
      { id: 'SH-007', name: 'Shelf E1 - Sparkling Beverages', location: 'Aisle 3 - Bay E - Tier 1', tare_weight_grams: 450, max_capacity_items: 24, current_product_id: null, created_at: isoNow, updated_at: isoNow },
      { id: 'SH-008', name: 'Shelf E2 - Premium Fresh Juices', location: 'Aisle 3 - Bay E - Tier 2', tare_weight_grams: 320, max_capacity_items: 18, current_product_id: null, created_at: isoNow, updated_at: isoNow },
    ];

    for (const sh of shelves) {
      insertShelf.run(sh);
    }

    // 2. Seed Products (13 products, 8 assigned to shelves, 5 available in catalog)
    const insertProduct = db.prepare(`
      INSERT INTO products (id, name, sku, category, description, unit_weight_grams, shelf_id, capacity, low_stock_threshold, created_at, updated_at)
      VALUES (@id, @name, @sku, @category, @description, @unit_weight_grams, @shelf_id, @capacity, @low_stock_threshold, @created_at, @updated_at)
    `);

    const products = [
      { id: 'PROD-001', name: 'Golden Wheat Biscuit Pack', sku: 'BIS-001', category: 'Bakery & Snacks', description: 'Crisp whole-wheat digestive biscuits, 100g pack', unit_weight_grams: 100, shelf_id: 'SH-001', capacity: 25, low_stock_threshold: 6, created_at: isoNow, updated_at: isoNow },
      { id: 'PROD-002', name: 'Choco Delight Cookies', sku: 'COK-002', category: 'Bakery & Snacks', description: 'Rich double chocolate chip cookies, 150g pack', unit_weight_grams: 150, shelf_id: 'SH-002', capacity: 20, low_stock_threshold: 5, created_at: isoNow, updated_at: isoNow },
      { id: 'PROD-003', name: 'Artisanal Sourdough Loaf', sku: 'BKD-003', category: 'Bakery & Snacks', description: 'Naturally fermented rustic sourdough bread loaf', unit_weight_grams: 400, shelf_id: 'SH-003', capacity: 15, low_stock_threshold: 4, created_at: isoNow, updated_at: isoNow },
      { id: 'PROD-004', name: 'Salted Pretzel Bites', sku: 'SNK-004', category: 'Bakery & Snacks', description: 'Crunchy oven-baked pretzels with sea salt', unit_weight_grams: 80, shelf_id: null, capacity: 30, low_stock_threshold: 8, created_at: isoNow, updated_at: isoNow },
      { id: 'PROD-005', name: 'Organic Whole Milk 1L', sku: 'DRY-005', category: 'Dairy & Refrigerated', description: 'Pasteurized homogenized organic farm milk', unit_weight_grams: 1030, shelf_id: 'SH-004', capacity: 16, low_stock_threshold: 4, created_at: isoNow, updated_at: isoNow },
      { id: 'PROD-006', name: 'Greek Yogurt Strawberry', sku: 'DRY-006', category: 'Dairy & Refrigerated', description: 'High protein Greek yogurt with real strawberry puree', unit_weight_grams: 170, shelf_id: 'SH-005', capacity: 24, low_stock_threshold: 6, created_at: isoNow, updated_at: isoNow },
      { id: 'PROD-007', name: 'Cheddar Cheese Block', sku: 'DRY-007', category: 'Dairy & Refrigerated', description: 'Sharp aged cheddar cheese block', unit_weight_grams: 250, shelf_id: 'SH-006', capacity: 20, low_stock_threshold: 5, created_at: isoNow, updated_at: isoNow },
      { id: 'PROD-008', name: 'Sparkling Spring Water 500ml', sku: 'BEV-008', category: 'Beverages & Juices', description: 'Zero calorie mineral sparkling water in PET bottle', unit_weight_grams: 520, shelf_id: 'SH-007', capacity: 24, low_stock_threshold: 6, created_at: isoNow, updated_at: isoNow },
      { id: 'PROD-009', name: 'Cold Pressed Orange Juice', sku: 'BEV-009', category: 'Beverages & Juices', description: '100% pure cold-pressed Valencia orange juice', unit_weight_grams: 350, shelf_id: 'SH-008', capacity: 18, low_stock_threshold: 5, created_at: isoNow, updated_at: isoNow },
      { id: 'PROD-010', name: 'Green Tea Citrus Infusion', sku: 'BEV-010', category: 'Beverages & Juices', description: 'Refreshing iced green tea with lemongrass and citrus', unit_weight_grams: 450, shelf_id: null, capacity: 20, low_stock_threshold: 5, created_at: isoNow, updated_at: isoNow },
      { id: 'PROD-011', name: 'Roasted Tomato Pasta Sauce', sku: 'PAN-011', category: 'Pantry & Canned Goods', description: 'Slow cooked Italian herb and tomato sauce', unit_weight_grams: 380, shelf_id: null, capacity: 16, low_stock_threshold: 4, created_at: isoNow, updated_at: isoNow },
      { id: 'PROD-012', name: 'Organic Rolled Oats 500g', sku: 'PAN-012', category: 'Pantry & Canned Goods', description: 'Whole grain gluten-free breakfast rolled oats', unit_weight_grams: 510, shelf_id: null, capacity: 20, low_stock_threshold: 5, created_at: isoNow, updated_at: isoNow },
      { id: 'PROD-013', name: 'Extra Virgin Olive Oil', sku: 'PAN-013', category: 'Pantry & Canned Goods', description: 'First cold pressed Mediterranean olive oil 750ml', unit_weight_grams: 850, shelf_id: null, capacity: 12, low_stock_threshold: 3, created_at: isoNow, updated_at: isoNow },
    ];

    for (const p of products) {
      insertProduct.run(p);
    }

    // Link current product back to shelves
    const updateShelfProduct = db.prepare('UPDATE shelves SET current_product_id = ? WHERE id = ?');
    updateShelfProduct.run('PROD-001', 'SH-001');
    updateShelfProduct.run('PROD-002', 'SH-002');
    updateShelfProduct.run('PROD-003', 'SH-003');
    updateShelfProduct.run('PROD-005', 'SH-004');
    updateShelfProduct.run('PROD-006', 'SH-005');
    updateShelfProduct.run('PROD-007', 'SH-006');
    updateShelfProduct.run('PROD-008', 'SH-007');
    updateShelfProduct.run('PROD-009', 'SH-008');

    // 3. Seed Sensors (8 sensors)
    const insertSensor = db.prepare(`
      INSERT INTO sensors (id, shelf_id, sensor_type, connection_status, last_seen_at, reporting_interval_sec, offline_timeout_sec, data_source, device_token, created_at, updated_at)
      VALUES (@id, @shelf_id, @sensor_type, @connection_status, @last_seen_at, @reporting_interval_sec, @offline_timeout_sec, @data_source, @device_token, @created_at, @updated_at)
    `);

    const pastDate = new Date(Date.now() - 45 * 60 * 1000).toISOString(); // 45 minutes ago

    const sensors = [
      { id: 'SEN-001', shelf_id: 'SH-001', sensor_type: 'HX711_LOAD_CELL_4CH', connection_status: 'ONLINE', last_seen_at: isoNow, reporting_interval_sec: 5, offline_timeout_sec: 15, data_source: 'SIMULATED', device_token: 'tok_sen_001', created_at: isoNow, updated_at: isoNow },
      { id: 'SEN-002', shelf_id: 'SH-002', sensor_type: 'HX711_LOAD_CELL_4CH', connection_status: 'ONLINE', last_seen_at: isoNow, reporting_interval_sec: 5, offline_timeout_sec: 15, data_source: 'SIMULATED', device_token: 'tok_sen_002', created_at: isoNow, updated_at: isoNow },
      { id: 'SEN-003', shelf_id: 'SH-003', sensor_type: 'HX711_LOAD_CELL_4CH', connection_status: 'ONLINE', last_seen_at: isoNow, reporting_interval_sec: 5, offline_timeout_sec: 15, data_source: 'SIMULATED', device_token: 'tok_sen_003', created_at: isoNow, updated_at: isoNow },
      { id: 'SEN-004', shelf_id: 'SH-004', sensor_type: 'HX711_LOAD_CELL_4CH', connection_status: 'ONLINE', last_seen_at: isoNow, reporting_interval_sec: 5, offline_timeout_sec: 15, data_source: 'SIMULATED', device_token: 'tok_sen_004', created_at: isoNow, updated_at: isoNow },
      { id: 'SEN-005', shelf_id: 'SH-005', sensor_type: 'HX711_LOAD_CELL_4CH', connection_status: 'ONLINE', last_seen_at: isoNow, reporting_interval_sec: 5, offline_timeout_sec: 15, data_source: 'SIMULATED', device_token: 'tok_sen_005', created_at: isoNow, updated_at: isoNow },
      { id: 'SEN-006', shelf_id: 'SH-006', sensor_type: 'HX711_LOAD_CELL_4CH', connection_status: 'ONLINE', last_seen_at: isoNow, reporting_interval_sec: 5, offline_timeout_sec: 15, data_source: 'SIMULATED', device_token: 'tok_sen_006', created_at: isoNow, updated_at: isoNow },
      { id: 'SEN-007', shelf_id: 'SH-007', sensor_type: 'HX711_LOAD_CELL_4CH', connection_status: 'ONLINE', last_seen_at: isoNow, reporting_interval_sec: 5, offline_timeout_sec: 15, data_source: 'SIMULATED', device_token: 'tok_sen_007', created_at: isoNow, updated_at: isoNow },
      { id: 'SEN-008', shelf_id: 'SH-008', sensor_type: 'HX711_LOAD_CELL_4CH', connection_status: 'OFFLINE', last_seen_at: pastDate, reporting_interval_sec: 5, offline_timeout_sec: 15, data_source: 'SIMULATED', device_token: 'tok_sen_008', created_at: isoNow, updated_at: isoNow },
    ];

    for (const sn of sensors) {
      insertSensor.run(sn);
    }

    // 4. Seed Inventory Records
    // SH-001 (PROD-001): 18 items -> IN_STOCK (18 * 100g = 1800g net + 250g tare = 2050g gross)
    // SH-002 (PROD-002): 4 items -> LOW_STOCK (4 * 150g = 600g net + 300g tare = 900g gross)
    // SH-003 (PROD-003): 0 items -> OUT_OF_STOCK (0 * 400g = 0g net + 400g tare = 400g gross)
    // SH-004 (PROD-005): 13 items -> IN_STOCK (13 * 1030g = 13390g net + 500g tare = 13890g gross)
    // SH-005 (PROD-006): 22 items -> IN_STOCK (22 * 170g = 3740g net + 350g tare = 4090g gross)
    // SH-006 (PROD-007): 3 items -> LOW_STOCK (3 * 250g = 750g net + 280g tare = 1030g gross)
    // SH-007 (PROD-008): 16 items -> IN_STOCK (16 * 520g = 8320g net + 450g tare = 8770g gross)
    // SH-008 (PROD-009): 2 items -> OFFLINE SENSOR condition, LOW_STOCK (2 * 350g = 700g net + 320g tare = 1020g gross)
    const insertInventory = db.prepare(`
      INSERT INTO inventory (product_id, shelf_id, current_gross_weight, current_net_weight, estimated_quantity, stock_percentage, stock_status, last_calculated_at)
      VALUES (@product_id, @shelf_id, @current_gross_weight, @current_net_weight, @estimated_quantity, @stock_percentage, @stock_status, @last_calculated_at)
    `);

    const inventoryRecords = [
      { product_id: 'PROD-001', shelf_id: 'SH-001', current_gross_weight: 2050, current_net_weight: 1800, estimated_quantity: 18, stock_percentage: 72.0, stock_status: 'IN_STOCK', last_calculated_at: isoNow },
      { product_id: 'PROD-002', shelf_id: 'SH-002', current_gross_weight: 900, current_net_weight: 600, estimated_quantity: 4, stock_percentage: 20.0, stock_status: 'LOW_STOCK', last_calculated_at: isoNow },
      { product_id: 'PROD-003', shelf_id: 'SH-003', current_gross_weight: 400, current_net_weight: 0, estimated_quantity: 0, stock_percentage: 0.0, stock_status: 'OUT_OF_STOCK', last_calculated_at: isoNow },
      { product_id: 'PROD-005', shelf_id: 'SH-004', current_gross_weight: 13890, current_net_weight: 13390, estimated_quantity: 13, stock_percentage: 81.25, stock_status: 'IN_STOCK', last_calculated_at: isoNow },
      { product_id: 'PROD-006', shelf_id: 'SH-005', current_gross_weight: 4090, current_net_weight: 3740, estimated_quantity: 22, stock_percentage: 91.67, stock_status: 'IN_STOCK', last_calculated_at: isoNow },
      { product_id: 'PROD-007', shelf_id: 'SH-006', current_gross_weight: 1030, current_net_weight: 750, estimated_quantity: 3, stock_percentage: 15.0, stock_status: 'LOW_STOCK', last_calculated_at: isoNow },
      { product_id: 'PROD-008', shelf_id: 'SH-007', current_gross_weight: 8770, current_net_weight: 8320, estimated_quantity: 16, stock_percentage: 66.67, stock_status: 'IN_STOCK', last_calculated_at: isoNow },
      { product_id: 'PROD-009', shelf_id: 'SH-008', current_gross_weight: 1020, current_net_weight: 700, estimated_quantity: 2, stock_percentage: 11.11, stock_status: 'LOW_STOCK', last_calculated_at: pastDate },
    ];

    for (const inv of inventoryRecords) {
      insertInventory.run(inv);
    }

    // 5. Seed Alerts
    const insertAlert = db.prepare(`
      INSERT INTO alerts (id, alert_type, severity, shelf_id, product_id, sensor_id, description, acknowledged, acknowledged_at, acknowledged_by, resolved, resolved_at, resolution_notes, created_at, updated_at)
      VALUES (@id, @alert_type, @severity, @shelf_id, @product_id, @sensor_id, @description, @acknowledged, @acknowledged_at, @acknowledged_by, @resolved, @resolved_at, @resolution_notes, @created_at, @updated_at)
    `);

    const alerts = [
      {
        id: 'ALT-1001',
        alert_type: 'OUT_OF_STOCK',
        severity: 'CRITICAL',
        shelf_id: 'SH-003',
        product_id: 'PROD-003',
        sensor_id: 'SEN-003',
        description: 'Shelf B1 is completely empty! Artisanal Sourdough Loaf is out of stock.',
        acknowledged: 0,
        acknowledged_at: null,
        acknowledged_by: null,
        resolved: 0,
        resolved_at: null,
        resolution_notes: null,
        created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        updated_at: new Date(Date.now() - 30 * 60 * 1000).toISOString()
      },
      {
        id: 'ALT-1002',
        alert_type: 'LOW_STOCK',
        severity: 'WARNING',
        shelf_id: 'SH-002',
        product_id: 'PROD-002',
        sensor_id: 'SEN-002',
        description: 'Choco Delight Cookies on Shelf A2 reached low-stock threshold (4 remaining / threshold: 5).',
        acknowledged: 1,
        acknowledged_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        acknowledged_by: 'Staff Member (Floor Supervisor)',
        resolved: 0,
        resolved_at: null,
        resolution_notes: null,
        created_at: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
        updated_at: new Date(Date.now() - 15 * 60 * 1000).toISOString()
      },
      {
        id: 'ALT-1003',
        alert_type: 'LOW_STOCK',
        severity: 'WARNING',
        shelf_id: 'SH-006',
        product_id: 'PROD-007',
        sensor_id: 'SEN-006',
        description: 'Cheddar Cheese Block on Shelf D1 is low on stock (3 remaining / threshold: 5).',
        acknowledged: 0,
        acknowledged_at: null,
        acknowledged_by: null,
        resolved: 0,
        resolved_at: null,
        resolution_notes: null,
        created_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
        updated_at: new Date(Date.now() - 20 * 60 * 1000).toISOString()
      },
      {
        id: 'ALT-1004',
        alert_type: 'SENSOR_OFFLINE',
        severity: 'WARNING',
        shelf_id: 'SH-008',
        product_id: 'PROD-009',
        sensor_id: 'SEN-008',
        description: 'Sensor SEN-008 on Shelf E2 has stopped transmitting readings (offline > 15s).',
        acknowledged: 0,
        acknowledged_at: null,
        acknowledged_by: null,
        resolved: 0,
        resolved_at: null,
        resolution_notes: null,
        created_at: new Date(Date.now() - 44 * 60 * 1000).toISOString(),
        updated_at: new Date(Date.now() - 44 * 60 * 1000).toISOString()
      },
      {
        id: 'ALT-1000',
        alert_type: 'LOW_STOCK',
        severity: 'WARNING',
        shelf_id: 'SH-001',
        product_id: 'PROD-001',
        sensor_id: 'SEN-001',
        description: 'Golden Wheat Biscuit Pack was low on stock (5 remaining). Restocked to 18.',
        acknowledged: 1,
        acknowledged_at: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
        acknowledged_by: 'Staff Member',
        resolved: 1,
        resolved_at: new Date(Date.now() - 75 * 60 * 1000).toISOString(),
        resolution_notes: 'Restocked 13 units from backroom inventory by John D.',
        created_at: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
        updated_at: new Date(Date.now() - 75 * 60 * 1000).toISOString()
      }
    ];

    for (const a of alerts) {
      insertAlert.run(a);
    }

    // 6. Seed Stock Movements
    const insertMovement = db.prepare(`
      INSERT INTO stock_movements (product_id, shelf_id, movement_type, quantity_delta, previous_quantity, new_quantity, previous_weight, new_weight, reason, notes, created_at)
      VALUES (@product_id, @shelf_id, @movement_type, @quantity_delta, @previous_quantity, @new_quantity, @previous_weight, @new_weight, @reason, @notes, @created_at)
    `);

    const movements = [
      {
        product_id: 'PROD-001',
        shelf_id: 'SH-001',
        movement_type: 'RESTOCK',
        quantity_delta: 13,
        previous_quantity: 5,
        new_quantity: 18,
        previous_weight: 750,
        new_weight: 2050,
        reason: 'Scheduled shelf restocking',
        notes: 'Restocked by Floor Associate',
        created_at: new Date(Date.now() - 75 * 60 * 1000).toISOString()
      },
      {
        product_id: 'PROD-002',
        shelf_id: 'SH-002',
        movement_type: 'CONSUMPTION',
        quantity_delta: -6,
        previous_quantity: 10,
        new_quantity: 4,
        previous_weight: 1800,
        new_weight: 900,
        reason: 'Customer purchase / shelf pickup',
        notes: 'Sensor weight decrease detected',
        created_at: new Date(Date.now() - 40 * 60 * 1000).toISOString()
      },
      {
        product_id: 'PROD-003',
        shelf_id: 'SH-003',
        movement_type: 'CONSUMPTION',
        quantity_delta: -4,
        previous_quantity: 4,
        new_quantity: 0,
        previous_weight: 2000,
        new_weight: 400,
        reason: 'Customer purchase / shelf pickup',
        notes: 'Shelf emptied completely',
        created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString()
      },
      {
        product_id: 'PROD-007',
        shelf_id: 'SH-006',
        movement_type: 'CONSUMPTION',
        quantity_delta: -5,
        previous_quantity: 8,
        new_quantity: 3,
        previous_weight: 2280,
        new_weight: 1030,
        reason: 'Customer purchase / shelf pickup',
        notes: 'Weight dropped below threshold',
        created_at: new Date(Date.now() - 20 * 60 * 1000).toISOString()
      }
    ];

    for (const m of movements) {
      insertMovement.run(m);
    }

    // 7. Seed Recent Sensor Readings
    const insertReading = db.prepare(`
      INSERT INTO sensor_readings (sensor_id, shelf_id, gross_weight_grams, reading_timestamp, server_receipt_timestamp, source, is_valid, notes)
      VALUES (@sensor_id, @shelf_id, @gross_weight_grams, @reading_timestamp, @server_receipt_timestamp, @source, @is_valid, @notes)
    `);

    // Add recent readings for each sensor across the past 30 minutes
    const sensorList = [
      { id: 'SEN-001', shelf: 'SH-001', gross: 2050 },
      { id: 'SEN-002', shelf: 'SH-002', gross: 900 },
      { id: 'SEN-003', shelf: 'SH-003', gross: 400 },
      { id: 'SEN-004', shelf: 'SH-004', gross: 13890 },
      { id: 'SEN-005', shelf: 'SH-005', gross: 4090 },
      { id: 'SEN-006', shelf: 'SH-006', gross: 1030 },
      { id: 'SEN-007', shelf: 'SH-007', gross: 8770 },
      { id: 'SEN-008', shelf: 'SH-008', gross: 1020 },
    ];

    for (const sn of sensorList) {
      // 5 historical data points
      for (let i = 5; i >= 1; i--) {
        const pointTime = new Date(Date.now() - i * 4 * 60 * 1000).toISOString();
        const jitter = (Math.random() - 0.5) * 4; // +/- 2g noise
        insertReading.run({
          sensor_id: sn.id,
          shelf_id: sn.shelf,
          gross_weight_grams: Math.round((sn.gross + jitter) * 10) / 10,
          reading_timestamp: pointTime,
          server_receipt_timestamp: pointTime,
          source: 'SIMULATED',
          is_valid: 1,
          notes: 'Routine telemetry report'
        });
      }
    }
  });

  seedTransaction();
  console.log('Seeding completed successfully!');
}

if (require.main === module) {
  try {
    seedDatabase(true);
    closeDatabase();
  } catch (err) {
    console.error('Error during seeding:', err);
    process.exit(1);
  }
}
