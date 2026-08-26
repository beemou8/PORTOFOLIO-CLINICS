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

const PUBLIC_DOMAIN = 'clinics.bimoporto.my.id';
const STAFF_DOMAIN = 'staff.clinics.bimoporto.my.id';

function Protected() {
  return getToken()
    ? <Layout />
    : <Navigate to="/login" replace />;
}

function AdminOnly({ children }: { children: ReactElement }) {
  return getUser()?.roles.includes('ADMIN')
    ? children
    : <Navigate to="/dashboard" replace />;
}

/*
 * DOMAIN PUBLIK
 *
 * Hanya:
 * /
 * /fasilitas
 * /verify/:token
 *
 * /login, /dashboard, /hr, dll tidak tersedia.
 */
function PublicRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />

      <Route
        path="/fasilitas"
        element={<Facilities />}
      />

      <Route
        path="/verify/:token"
        element={<VerifyDocument />}
      />

      {/* Semua URL lain kembali ke homepage publik */}
      <Route
        path="*"
        element={<Navigate to="/" replace />}
      />
    </Routes>
  );
}

/*
 * DOMAIN STAFF
 *
 * Tidak menyediakan landing page publik.
 */
function StaffRoutes() {
  const loggedIn = Boolean(getToken());

  return (
    <Routes>

      {/* root staff */}
      <Route
        path="/"
        element={
          <Navigate
            to={loggedIn ? '/dashboard' : '/login'}
            replace
          />
        }
      />

      <Route
        path="/login"
        element={
          loggedIn
            ? <Navigate to="/dashboard" replace />
            : <Login />
        }
      />

      {/* SEMUA HALAMAN INTERNAL WAJIB LOGIN */}
      <Route element={<Protected />}>

        <Route
          path="/dashboard"
          element={<Dashboard />}
        />

        <Route
          path="/registration"
          element={<Registration />}
        />

        <Route
          path="/admin"
          element={<Admin />}
        />

        <Route
          path="/doctor"
          element={<Doctor />}
        />

        <Route
          path="/patient-history"
          element={<PatientHistory />}
        />

        <Route
          path="/pharmacy"
          element={<Pharmacy />}
        />

        <Route
          path="/finance"
          element={<Finance />}
        />

        <Route
          path="/hr"
          element={<HR />}
        />

        <Route
          path="/settings"
          element={
            <AdminOnly>
              <Settings />
            </AdminOnly>
          }
        />

      </Route>

      {/* URL staff yang tidak dikenal */}
      <Route
        path="*"
        element={
          <Navigate
            to={loggedIn ? '/dashboard' : '/login'}
            replace
          />
        }
      />

    </Routes>
  );
}

export default function App() {
  const hostname = window.location.hostname.toLowerCase();

  /*
   * PRODUCTION PUBLIC
   */
  if (hostname === PUBLIC_DOMAIN) {
    return <PublicRoutes />;
  }

  /*
   * PRODUCTION STAFF
   */
  if (hostname === STAFF_DOMAIN) {
    return <StaffRoutes />;
  }

  /*
   * DEVELOPMENT
   *
   * localhost tetap bisa mengakses semuanya
   * supaya development tidak ribet.
   */
  return (
    <Routes>

      <Route path="/" element={<Landing />} />
      <Route path="/fasilitas" element={<Facilities />} />
      <Route path="/verify/:token" element={<VerifyDocument />} />
      <Route path="/login" element={<Login />} />

      <Route element={<Protected />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/registration" element={<Registration />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/doctor" element={<Doctor />} />
        <Route path="/patient-history" element={<PatientHistory />} />
        <Route path="/pharmacy" element={<Pharmacy />} />
        <Route path="/finance" element={<Finance />} />
        <Route path="/hr" element={<HR />} />
        <Route
          path="/settings"
          element={
            <AdminOnly>
              <Settings />
            </AdminOnly>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />

    </Routes>
  );
}