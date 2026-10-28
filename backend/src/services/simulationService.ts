import { getDatabase } from '../db/connection';
import { sensorService } from './sensorService';
import { seedDatabase } from '../db/seed';
import { logger } from '../utils/logger';

export type SimulationScenario = 'NORMAL' | 'RUSH_HOUR' | 'RESTOCK_RUN' | 'SENSOR_DISCONNECT';

export interface SimulationStatus {
  isActive: boolean;
  scenario: SimulationScenario;
  tickIntervalMs: number;
  lastTickAt: string | null;
  totalTicks: number;
}

export class SimulationService {
  private db = getDatabase();
  private timer: NodeJS.Timeout | null = null;
  private scenario: SimulationScenario = 'NORMAL';
  private tickIntervalMs: number = 4000;
  private isActive: boolean = false;
  private lastTickAt: string | null = null;
  private totalTicks: number = 0;

  constructor() {
    // Check if simulation mode setting is enabled
    const setting = this.db.prepare("SELECT value FROM settings WHERE key = 'simulation_mode'").get() as { value: string } | undefined;
    if (setting && setting.value === 'true') {
      // Auto-start simulation in normal mode
      this.start('NORMAL', 4000);
    }
  }

  public getStatus(): SimulationStatus {
    return {
      isActive: this.isActive,
      scenario: this.scenario,
      tickIntervalMs: this.tickIntervalMs,
      lastTickAt: this.lastTickAt,
      totalTicks: this.totalTicks,
    };
  }

  public start(scenario: SimulationScenario = 'NORMAL', intervalMs: number = 4000): SimulationStatus {
    this.stop(); // Clear any existing timer to prevent duplicates

    this.scenario = scenario;
    this.tickIntervalMs = Math.max(1000, intervalMs);
    this.isActive = true;
    logger.info(`Starting sensor simulation with scenario '${scenario}' every ${this.tickIntervalMs}ms`);

    this.timer = setInterval(() => {
      try {
        this.runSimulationTick();
      } catch (err) {
        logger.error('Error during simulation tick:', err);
      }
    }, this.tickIntervalMs);

    // Run first tick immediately
    this.runSimulationTick();

    return this.getStatus();
  }

  public stop(): SimulationStatus {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isActive = false;
    logger.info('Sensor simulation stopped.');
    return this.getStatus();
  }

  public setScenario(scenario: SimulationScenario): SimulationStatus {
    this.scenario = scenario;
    logger.info(`Simulation scenario switched to '${scenario}'`);
    if (!this.isActive) {
      return this.start(scenario, this.tickIntervalMs);
    }
    return this.getStatus();
  }

  public resetDataset(): void {
    logger.info('Resetting simulation demo dataset to baseline seed data...');
    const wasActive = this.isActive;
    this.stop();
    seedDatabase(true);
    if (wasActive) {
      this.start(this.scenario, this.tickIntervalMs);
    }
  }

  /**
   * Executes one tick of the sensor simulator based on active scenario.
   */
  private runSimulationTick(): void {
    this.lastTickAt = new Date().toISOString();
    this.totalTicks++;

    // Check sensor offline timeouts on every 3rd tick
    if (this.totalTicks % 3 === 0) {
      sensorService.checkSensorHealth();
    }

    // Retrieve active online sensors with their shelf and product specs
    const activeSensors = this.db.prepare(`
      SELECT 
        s.id as sensor_id, s.shelf_id, s.connection_status,
        sh.tare_weight_grams, sh.max_capacity_items,
        p.id as product_id, p.name as product_name, p.unit_weight_grams,
        p.capacity as product_capacity, p.low_stock_threshold,
        i.estimated_quantity, i.current_gross_weight
      FROM sensors s
      JOIN shelves sh ON s.shelf_id = sh.id
      JOIN products p ON sh.current_product_id = p.id
      LEFT JOIN inventory i ON (i.shelf_id = sh.id AND i.product_id = p.id)
      WHERE s.data_source = 'SIMULATED'
    `).all() as any[];

    if (!activeSensors || activeSensors.length === 0) return;

    for (const sensor of activeSensors) {
      // In SENSOR_DISCONNECT scenario, keep SEN-008 and occasionally SEN-007 offline without telemetry
      if (this.scenario === 'SENSOR_DISCONNECT' && (sensor.sensor_id === 'SEN-008' || sensor.sensor_id === 'SEN-007')) {
        continue; // simulate disconnection: no packet sent
      }

      // If sensor is SEN-008 in other scenarios, keep it offline unless user restocked or reconnected
      if (sensor.sensor_id === 'SEN-008' && this.scenario !== 'RESTOCK_RUN') {
        continue; // Keep SEN-008 offline as our baseline offline test case
      }

      const tare = sensor.tare_weight_grams || 0;
      const unitWeight = sensor.unit_weight_grams;
      const maxCap = sensor.product_capacity || sensor.max_capacity_items || 20;
      let currentQty = sensor.estimated_quantity !== null && sensor.estimated_quantity !== undefined 
        ? sensor.estimated_quantity 
        : Math.round(maxCap * 0.7);

      // Apply scenario behavior
      if (this.scenario === 'NORMAL') {
        // Stochastic shopping: 15% chance of customer picking 1 item, 2% chance of return (+1)
        const rand = Math.random();
        if (rand < 0.15 && currentQty > 0) {
          currentQty = Math.max(0, currentQty - 1);
        } else if (rand > 0.98 && currentQty < maxCap) {
          currentQty = Math.min(maxCap, currentQty + 1);
        }
      } else if (this.scenario === 'RUSH_HOUR') {
        // High shopping activity: 50% chance of 1 or 2 items removed
        if (Math.random() < 0.50 && currentQty > 0) {
          const removed = Math.random() < 0.3 ? 2 : 1;
          currentQty = Math.max(0, currentQty - 1);
        }
      } else if (this.scenario === 'RESTOCK_RUN') {
        // Restock run: If shelf is low or empty, bring it back to full
        if (currentQty < Math.round(maxCap * 0.8)) {
          currentQty = Math.min(maxCap, currentQty + 4);
        }
      }

      // Calculate new gross weight with small analog sensor noise (+/- 1.5g jitter)
      const noise = (Math.random() - 0.5) * 3;
      const netWeight = currentQty * unitWeight;
      const calculatedGross = Math.max(0, Math.round((tare + netWeight + noise) * 10) / 10);

      // Send telemetry reading to sensor service
      try {
        sensorService.processReading({
          sensorId: sensor.sensor_id,
          grossWeightGrams: calculatedGross,
          timestamp: new Date().toISOString(),
          source: 'SIMULATED',
        });
      } catch (err) {
        logger.error(`Simulation failed to post reading for ${sensor.sensor_id}:`, err);
      }
    }
  }
}

export const simulationService = new SimulationService();
