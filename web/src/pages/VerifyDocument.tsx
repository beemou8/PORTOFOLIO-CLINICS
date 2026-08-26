import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';

type Verification = {
  valid:boolean; clinic:string; message:string;
  document?:{documentNo:string;type:string;title:string;status:string;issuedAt:string;restStartDate?:string;restEndDate?:string};
  visit?:{registrationNo:string;visitDate:string;patientName:string;branchName?:string};
  doctor?:{name:string;specialization?:string;sipNumber?:string};
};

const fmt=(d?:string)=>d?new Date(d).toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'}):'-';

export default function VerifyDocument(){
  const {token}=useParams();
  const [data,setData]=useState<Verification|null>(null);
  const [error,setError]=useState('');
  useEffect(()=>{if(token)api<Verification>(`/verification/documents/${token}`).then(setData).catch(e=>setError(e.message));},[token]);
  return <main className="verify-page"><section className="verify-card">
    <div className="verify-brand"><span>+</span><div><b>BIM CLINICS</b><small>Medical Document Verification</small></div></div>
    {error?<><div className="verify-status invalid">Tidak Terverifikasi</div><h1>Surat tidak valid</h1><p>{error}</p></>:!data?<div className="empty">Memeriksa surat...</div>:<>
      <div className={`verify-status ${data.valid?'valid':'invalid'}`}>{data.valid?'✓ TERVERIFIKASI':'✕ BELUM VALID'}</div>
      <h1>{data.valid?'Surat resmi BIM CLINICS':'Verifikasi surat'}</h1><p>{data.message}</p>
      {data.document&&<div className="verify-details">
        <div><small>No. Surat</small><b>{data.document.documentNo}</b></div>
        <div><small>Pasien</small><b>{data.visit?.patientName}</b></div>
        <div><small>Tanggal Berobat</small><b>{fmt(data.visit?.visitDate)}</b></div>
        <div><small>No. Registrasi</small><b>{data.visit?.registrationNo}</b></div>
        <div><small>Dokter</small><b>{data.doctor?.name}</b></div>
        <div><small>SIP</small><b>{data.doctor?.sipNumber||'-'}</b></div>
        <div><small>Cabang</small><b>{data.visit?.branchName||'BIM CLINICS'}</b></div>
        <div><small>Status Surat</small><b>{data.document.status}</b></div>
        {(data.document.restStartDate||data.document.restEndDate)&&<div className="wide"><small>Rekomendasi Istirahat</small><b>{fmt(data.document.restStartDate)} — {fmt(data.document.restEndDate)}</b></div>}
      </div>}
      <div className="privacy-note">Halaman ini hanya menampilkan data yang diperlukan untuk memastikan surat benar berasal dari BIM CLINICS. Diagnosis dan isi rekam medis tidak ditampilkan.</div>
    </>}
  </section></main>;
}
