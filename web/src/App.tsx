import type { ReactElement } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Facilities from './pages/Facilities';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import HR from './pages/HR';
import Registration from './pages/Registration';
import Doctor from './pages/Doctor';
import Pharmacy from './pages/Pharmacy';
import Finance from './pages/Finance';
import Admin from './pages/Admin';
import Settings from './pages/Settings';
import VerifyDocument from './pages/VerifyDocument';
import PatientHistory from './pages/PatientHistory';
import { getToken, getUser } from './lib/api';

function Protected() {
  return getToken() ? <Layout /> : <Navigate to="/login" replace />;
}

// Backend selalu jadi sumber kebenaran akses (allowRoles('ADMIN')); guard ini hanya
// mencegah UI terbuka di client untuk role yang bukan ADMIN.
function AdminOnly({ children }: { children: ReactElement }) {
  return getUser()?.roles.includes('ADMIN') ? children : <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <Routes>
      {/* PUBLIC: tidak perlu login */}
      <Route path="/" element={<Landing />} />
      <Route path="/fasilitas" element={<Facilities />} />
      <Route path="/login" element={<Login />} />
      <Route path="/verify/:token" element={<VerifyDocument />} />

      {/* INTERNAL: wajib login */}
      <Route element={<Protected />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/registration" element={<Registration />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/doctor" element={<Doctor />} />
        <Route path="/patient-history" element={<PatientHistory />} />
        <Route path="/pharmacy" element={<Pharmacy />} />
        <Route path="/finance" element={<Finance />} />
        <Route path="/hr" element={<HR />} />
        <Route path="/settings" element={<AdminOnly><Settings /></AdminOnly>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
