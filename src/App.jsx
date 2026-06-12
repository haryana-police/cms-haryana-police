import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { ProtectedRoute } from './components/Auth/ProtectedRoute';

// ─── ALL heavy components are lazy ────────────────────────────────────────
// The login page must load with ZERO antd/icon/pdfjs dependencies.
// Every page that imports antd or heavy libs is lazy-loaded.
// ──────────────────────────────────────────────────────────────────────────
const AppShell       = lazy(() => import('./components/Layout/AppShell'));
const Login          = lazy(() => import('./pages/Login'));
const Dashboard      = lazy(() => import('./pages/Dashboard'));
const Complaints     = lazy(() => import('./pages/Complaints'));
const Investigation  = lazy(() => import('./pages/Investigation'));
const AnalysisPage   = lazy(() => import('./pages/Analysis/AnalysisPage'));
const FIRListPage    = lazy(() => import('./pages/FIR/FIRListPage'));
const FIRForm        = lazy(() => import('./pages/FIR/FIRForm'));
const FIRDetail      = lazy(() => import('./pages/FIR/FIRDetail'));
const UserManagement = lazy(() => import('./pages/Admin/UserManagement'));
const LawLibrary     = lazy(() => import('./pages/LawLibrary'));
const AiChat         = lazy(() => import('./pages/AiChat'));

// Minimal spinner — pure CSS, zero dependencies
const PageLoader = () => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100vh', background: '#0d1117', flexDirection: 'column', gap: 14,
  }}>
    <div style={{
      width: 36, height: 36, borderRadius: '50%',
      border: '3px solid #1f2937', borderTopColor: '#3b82f6',
      animation: 'spin 0.7s linear infinite',
    }} />
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    <span style={{ color: '#6b7280', fontSize: 13, fontFamily: 'sans-serif' }}>Loading…</span>
  </div>
);

const S = ({ children }) => <Suspense fallback={<PageLoader />}>{children}</Suspense>;

const Placeholder = ({ title }) => (
  <div style={{ padding: 24, textAlign: 'center', fontFamily: 'sans-serif' }}>
    <h2>{title}</h2><p>Coming soon.</p>
  </div>
);

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<S><Login /></S>} />

          <Route element={<ProtectedRoute />}>
            <Route element={<S><AppShell /></S>}>
              <Route path="/"             element={<S><Dashboard /></S>} />
              <Route path="/complaints"   element={<S><Complaints /></S>} />
              <Route path="/fir"          element={<S><FIRListPage /></S>} />
              <Route path="/fir/new"      element={<S><FIRForm /></S>} />
              <Route path="/fir/:id"      element={<S><FIRDetail /></S>} />
              <Route path="/investigation" element={<S><Investigation /></S>} />
              <Route path="/hc-reply"     element={<Placeholder title="M4: HC Reply" />} />
              <Route path="/analysis"     element={<S><AnalysisPage /></S>} />
              <Route path="/search"       element={<Placeholder title="M6: Smart Search" />} />
              <Route path="/crime-map"    element={<Placeholder title="M7: Preventive Policing" />} />
              <Route path="/gd"           element={<Placeholder title="M8: Smart GD" />} />
              <Route path="/admin/users"  element={<S><UserManagement /></S>} />
              <Route path="*"             element={<Placeholder title="Page Not Found" />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
