import { useEffect, useState } from 'react';
import { api, getUser } from '../lib/api';

type Summary = {
  patients_today: number;
  waiting_doctor: number;
  pending_prescriptions: number;
  net_profit_today: number;
};

const idr = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

export default function Dashboard() {
  const u = getUser();
  const branch = u?.roles.includes('ADMIN') ? 'Seluruh Cabang' : (u?.branchName || 'Cabang belum diatur');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api<Summary>('/dashboard/summary').then(setSummary).catch((e) => setMsg(e.message));
  }, []);

  return <>
    <header className="page-head">
      <div>
        <small>RINGKASAN OPERASIONAL · {branch}</small>
        <h1>{u?.fullName}</h1>
        <p>{today}</p>
      </div>
    </header>
    {msg && <div className="alert error">{msg}</div>}
    <section className="stats">
      <div className="stat"><span>Kunjungan Hari Ini</span><b>{summary ? summary.patients_today : '…'}</b><small>Registrasi tercatat pada tanggal berjalan</small></div>
      <div className="stat"><span>Menunggu Pemeriksaan</span><b>{summary ? summary.waiting_doctor : '…'}</b><small>Kunjungan dalam antrean dokter</small></div>
      <div className="stat"><span>Resep Belum Diserahkan</span><b>{summary ? summary.pending_prescriptions : '…'}</b><small>Menunggu proses apotek</small></div>
      <div className="stat"><span>Laba Bersih Hari Ini</span><b>{summary ? idr.format(summary.net_profit_today) : '…'}</b><small>Pendapatan dikurangi HPP dan beban operasional</small></div>
    </section>
    <section className="panel">
      <div className="panel-title">
        <div><h2>Alur Pelayanan</h2><p>Setiap tahapan menggunakan satu sumber data yang sama dan mengikuti hak akses cabang pengguna.</p></div>
      </div>
      <div className="flow"><span>Registrasi</span><i>→</i><span>Pemeriksaan Dokter</span><i>→</i><span>Apotek / Administrasi</span><i>→</i><span>Pembayaran</span><i>→</i><span>Finance</span></div>
    </section>
  </>;
}
