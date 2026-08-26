import { useEffect, useState } from 'react';
import { api } from '../lib/api';

type PatientSearch = {
  id:number; medical_record_no:string; nik?:string|null; full_name:string; birth_date?:string|null;
  gender?:'M'|'F'|null; phone?:string|null; total_visits:number; last_visit_date?:string|null;
};

type Medication = {name:string;qty:string|number;unit:string;dosage?:string|null;frequency?:string|null;durationDays?:number|null;instruction?:string|null};
type HistoryItem = {
  id:number; registration_no:string; visit_date:string; created_at:string; complaint?:string|null; status:string;
  branch_name:string; doctor_name?:string|null; specialization?:string|null; anamnesis?:string|null; diagnosis?:string|null;
  treatment_notes?:string|null; systolic?:number|null; diastolic?:number|null; temperature?:string|number|null; weight_kg?:string|number|null;
  medications:Medication[];
};
type HistoryResponse = {
  patient:{id:number;medical_record_no:string;nik?:string|null;full_name:string;birth_date?:string|null;gender?:string|null;phone?:string|null;address?:string|null};
  stats:{totalVisits:number;diagnosedVisits:number;firstVisitDate?:string|null;lastVisitDate?:string|null};
  history:HistoryItem[];
};

function fmtDate(value?:string|null){
  if(!value)return '-';
  return new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(`${value.slice(0,10)}T00:00:00`));
}

export default function PatientHistory(){
  const [search,setSearch]=useState('');
  const [patients,setPatients]=useState<PatientSearch[]>([]);
  const [selected,setSelected]=useState<PatientSearch|null>(null);
  const [detail,setDetail]=useState<HistoryResponse|null>(null);
  const [loading,setLoading]=useState(false);
  const [msg,setMsg]=useState('');

  async function findPatients(term=search){
    setLoading(true);setMsg('');
    try{setPatients(await api<PatientSearch[]>(`/patients/history-search?search=${encodeURIComponent(term)}`));}
    catch(e){setMsg(e instanceof Error?e.message:'Gagal mencari pasien');}
    finally{setLoading(false);}
  }

  async function openPatient(p:PatientSearch){
    setSelected(p);setDetail(null);setMsg('');setLoading(true);
    try{setDetail(await api<HistoryResponse>(`/patients/${p.id}/history`));}
    catch(e){setMsg(e instanceof Error?e.message:'Gagal memuat riwayat pasien');}
    finally{setLoading(false);}
  }

  useEffect(()=>{void findPatients('');},[]);

  return <>
    <header className="page-head"><div><small>CLINICAL HISTORY</small><h1>Riwayat Pasien</h1><p>Cari dengan nama, NIK, atau nomor rekam medis.</p></div></header>
    {msg&&<div className="alert">{msg}</div>}
    <div className="history-layout">
      <section className="panel history-search-panel">
        <div className="history-search"><input placeholder="Nama / NIK / No. RM" value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void findPatients();}}/><button className="secondary" onClick={()=>void findPatients()} disabled={loading}>Cari</button></div>
        <div className="history-patient-list">
          {patients.length===0&&!loading?<div className="empty">Belum ada pasien yang dapat ditampilkan.</div>:patients.map(p=><button key={p.id} className={`history-patient ${selected?.id===p.id?'selected':''}`} onClick={()=>void openPatient(p)}>
            <div><b>{p.full_name}</b><small>{p.medical_record_no}{p.nik?` · NIK ${p.nik}`:''}</small></div>
            <span><b>{p.total_visits}</b><small>kunjungan</small></span>
          </button>)}
        </div>
      </section>
      <section className="panel history-detail-panel">
        {!selected?<div className="empty">Pilih pasien untuk melihat riwayat klinis.</div>:loading&&!detail?<div className="empty">Memuat riwayat...</div>:detail?<HistoryDetail data={detail}/>:null}
      </section>
    </div>
  </>;
}

export function HistoryDetail({data,compact=false}:{data:HistoryResponse;compact?:boolean}){
  return <div className={compact?'patient-history compact':'patient-history'}>
    <div className="patient-history-head">
      <div><small>REKAM MEDIS</small><h2>{data.patient.full_name}</h2><p>{data.patient.medical_record_no}{data.patient.nik?` · NIK ${data.patient.nik}`:''}</p></div>
      <div className="history-stat"><strong>{data.stats.totalVisits}</strong><span>Total kunjungan</span></div>
    </div>
    <div className="history-summary">
      <div><small>Pertama datang</small><b>{fmtDate(data.stats.firstVisitDate)}</b></div>
      <div><small>Terakhir datang</small><b>{fmtDate(data.stats.lastVisitDate)}</b></div>
      <div><small>Kunjungan terdiagnosis</small><b>{data.stats.diagnosedVisits}</b></div>
    </div>
    <div className="history-timeline">
      {data.history.map((h,i)=><article className="history-entry" key={h.id}>
        <div className="history-line"><span className="history-dot"></span>{i<data.history.length-1&&<span className="history-rail"></span>}</div>
        <div className="history-entry-body">
          <div className="history-entry-top"><div><b>{fmtDate(h.visit_date)}</b><small>{h.registration_no} · {h.branch_name}</small></div><span className="history-status">{h.status.replaceAll('_',' ')}</span></div>
          <div className="history-doctor">{h.doctor_name||'Dokter belum ditentukan'}{h.specialization?` · ${h.specialization}`:''}</div>
          <div className="history-grid">
            <div><small>Keluhan</small><p>{h.complaint||'-'}</p></div>
            <div className={h.diagnosis?'diagnosis-box':''}><small>Diagnosis</small><p>{h.diagnosis||'Belum ada diagnosis'}</p></div>
            {h.anamnesis&&<div><small>Anamnesis</small><p>{h.anamnesis}</p></div>}
            {h.treatment_notes&&<div><small>Tindakan / Catatan</small><p>{h.treatment_notes}</p></div>}
          </div>
          {(h.systolic||h.diastolic||h.temperature||h.weight_kg)&&<div className="vital-row">
            {(h.systolic||h.diastolic)&&<span>TD <b>{h.systolic||'-'}/{h.diastolic||'-'}</b> mmHg</span>}
            {h.temperature&&<span>Suhu <b>{h.temperature}</b> °C</span>}
            {h.weight_kg&&<span>BB <b>{h.weight_kg}</b> kg</span>}
          </div>}
          {Array.isArray(h.medications)&&h.medications.length>0&&<div className="history-meds"><small>Obat / Resep</small><div>{h.medications.map((m,idx)=><span key={`${m.name}-${idx}`}><b>{m.name}</b> · {m.qty} {m.unit}{m.frequency?` · ${m.frequency}`:''}</span>)}</div></div>}
        </div>
      </article>)}
    </div>
  </div>;
}

export type { HistoryResponse };
