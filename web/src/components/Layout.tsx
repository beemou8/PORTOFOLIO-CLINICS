import { NavLink, Outlet } from 'react-router-dom';
import { getUser, logout } from '../lib/api';

const items = [
  { to: '/dashboard', label: 'Dashboard', roles: ['ALL'] },
  { to: '/registration', label: 'Registrasi', roles: ['ADMIN','HR','NURSE'] },
  { to: '/admin', label: 'Administrasi', roles: ['ADMIN'] },
  { to: '/doctor', label: 'Dokter', roles: ['ADMIN','DOCTOR'] },
  { to: '/patient-history', label: 'Riwayat Pasien', roles: ['ADMIN','DOCTOR','NURSE'] },
  { to: '/pharmacy', label: 'Apotek', roles: ['ADMIN','PHARMACY'] },
  { to: '/finance', label: 'Finance', roles: ['ADMIN','FINANCE'] },
  { to: '/hr', label: 'HR', roles: ['ADMIN','HR'] },
  { to: '/settings', label: 'Pengaturan', roles: ['ADMIN'] },
];

export default function Layout() {
  const user = getUser();
  const visible = items.filter(item => item.roles.includes('ALL') || item.roles.some(r => user?.roles.includes(r)));

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span>+</span><div><b>BIM CLINICS</b><small>Management System</small></div></div>
        <div className="branch-badge">
          <small>CABANG AKTIF</small>
          <strong>{user?.roles.includes('ADMIN') ? 'Semua Cabang' : (user?.branchName || 'Belum diatur')}</strong>
        </div>
        <nav>
          {visible.map(({to, label}) => (
            <NavLink key={to} to={to} end={to === '/dashboard'} className={({isActive}) => isActive ? 'nav active' : 'nav'}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div><strong>{user?.fullName}</strong><small>{user?.roles.join(', ')}</small></div>
          <button className="ghost" onClick={logout}>Keluar</button>
        </div>
      </aside>
      <main className="main"><Outlet /></main>
    </div>
  );
}
