import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { ShelfMonitoringPage } from './pages/ShelfMonitoringPage';
import { ProductManagementPage } from './pages/ProductManagementPage';
import { InventoryManagementPage } from './pages/InventoryManagementPage';
import { SensorDevicesPage } from './pages/SensorDevicesPage';
import { AlertsPage } from './pages/AlertsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SettingsPage } from './pages/SettingsPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="shelves" element={<ShelfMonitoringPage />} />
          <Route path="products" element={<ProductManagementPage />} />
          <Route path="inventory" element={<InventoryManagementPage />} />
          <Route path="sensors" element={<SensorDevicesPage />} />
          <Route path="alerts" element={<AlertsPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};
