import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { ProtectedRoute } from './components/Auth/ProtectedRoute';
import AppShell from './components/Layout/AppShell';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Investigation from './pages/Investigation';

// Module Placeholders
const Placeholder = ({ title }) => (
  <div style={{ padding: '24px', textAlign: 'center' }}>
    <h2>{title}</h2>
    <p>Module coming soon. To be implemented by the team.</p>
  </div>
);

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/complaints" element={<Placeholder title="M1: Complaints" />} />
              <Route path="/fir" element={<Placeholder title="M2: FIRs" />} />
              <Route path="/investigation" element={<Investigation />} />
              <Route path="/hc-reply" element={<Placeholder title="M4: HC Reply" />} />
              <Route path="/analysis" element={<Placeholder title="M5: Case Analysis" />} />
              <Route path="/search" element={<Placeholder title="M6: Smart Search" />} />
              <Route path="/crime-map" element={<Placeholder title="M7: Preventive Policing" />} />
              <Route path="/gd" element={<Placeholder title="M8: Smart GD" />} />
              <Route path="*" element={<Placeholder title="Page Not Found" />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
