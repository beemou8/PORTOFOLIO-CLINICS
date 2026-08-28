import { FormEvent, useEffect, useState } from 'react';
import { api, getUser } from '../lib/api';
import { HistoryDetail, type HistoryResponse } from './PatientHistory';

type Visit = { id:number; patient_id:number; registration_no:string; patient_name:string; complaint?:string; status:string; branch_name?:string };
type Med = { id:number; name:string; unit:string; total_stock:string };

export default function Doctor() {
  const user = getUser();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [meds, setMeds] = useState<Med[]>([]);
  const [selected, setSelected] = useState<Visit | null>(null);
  const [msg, setMsg] = useState('');
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const [medicationId, setMedicationId] = useState('');
  const [qty, setQty] = useState('');
  const [letterTitle, setLetterTitle] = useState('Surat Keterangan Sakit');
  const [letterContent, setLetterContent] = useState('');
  const [restStartDate, setRestStartDate] = useState('');
  const [restEndDate, setRestEndDate] = useState('');

  const load = async () => {
    try { setVisits(await api<Visit[]>('/visits?status=WAITING_DOCTOR')); }
    catch (e) { setMsg(e instanceof Error ? e.message : 'Gagal memuat antrean'); }
  };

  useEffect(() => {
    void load();
    void api<Med[]>('/pharmacy/medications').then(setMeds).catch(() => {});
  }, []);

  async function chooseVisit(v: Visit) {
    setSelected(v);
    setHistory(null);
    setDiagnosis('');
    setNotes('');
    setHistoryLoading(true);
    setMsg('');
    try {
      const data = await api<HistoryResponse>(`/patients/${v.patient_id}/history`);
      setHistory(data);
      const current = data.history?.find((item) => Number(item.id) === Number(v.id));
      if (current?.diagnosis) setDiagnosis(String(current.diagnosis));
      if (current?.treatment_notes) setNotes(String(current.treatment_notes));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal memuat riwayat pasien');
    } finally {
      setHistoryLoading(false);
    }
  }

  async function saveRecord(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    try {
      await api(`/visits/${selected.id}/medical-record`, { method:'POST', body:JSON.stringify({ diagnosis, treatmentNotes:notes }) });
      setMsg('Rekam medis tersimpan.');
      setHistory(await api<HistoryResponse>(`/patients/${selected.patient_id}/history`));
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Gagal'); }
  }

  async function sendPrescription() {
    if (!selected || !medicationId || !qty) return;
    try {
      await api(`/prescriptions/visit/${selected.id}`, { method:'POST', body:JSON.stringify({ items:[{ medicationId:Number(medicationId), qty:Number(qty) }] }) });
      setMsg('Resep terkirim ke Apotek pada cabang kunjungan.');
      setHistory(await api<HistoryResponse>(`/patients/${selected.patient_id}/history`));
      await load();
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Gagal'); }
  }

  async function sendLetter() {
    if (!selected || !letterTitle || !letterContent || !diagnosis.trim()) {
      setMsg('Diagnosis, judul surat, dan isi surat wajib diisi.');
      return;
    }
    try {
      await api(`/visits/${selected.id}/documents`, {
        method:'POST',
        body:JSON.stringify({
          documentType:'SICK_LETTER',
          title:letterTitle,
          content:letterContent,
          diagnosis:diagnosis.trim(),
          restStartDate:restStartDate || null,
          restEndDate:restEndDate || null,
        }),
      });
      setLetterContent('');
      setRestStartDate('');
      setRestEndDate('');
      setMsg('Surat BIM CLINICS terkirim ke Administrasi. Diagnosis ikut tercantum pada surat dan QR verifikasi sudah dibuat.');
      setHistory(await api<HistoryResponse>(`/patients/${selected.patient_id}/history`));
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Gagal'); }
  }

  return <>
    <header className="page-head"><div><small>DOCTOR WORKSPACE · {user?.branchName || 'BIM CLINICS'}</small><h1>Pemeriksaan Dokter</h1><p>Pilih pasien untuk melihat riwayat berobat sebelum melakukan pemeriksaan.</p></div></header>
    {msg && <div className="alert">{msg}</div>}
    <div className="two-col doctor-workspace">
      <section className="panel">
        <div className="panel-title"><h2>Antrean</h2></div>
        {visits.length === 0 ? <div className="empty">Belum ada pasien menunggu.</div> : visits.map(v => <button key={v.id} className={`queue ${selected?.id === v.id ? 'selected' : ''}`} onClick={() => void chooseVisit(v)}><b>{v.patient_name}</b><small>{v.registration_no} · {v.branch_name || ''}</small><span>{v.complaint || 'Tanpa keluhan awal'}</span></button>)}
      </section>
      <section className="panel">
        {!selected ? <div className="empty">Pilih pasien dari antrean.</div> : <>
          <div className="panel-title"><div><h2>{selected.patient_name}</h2><p>{selected.complaint}</p></div></div>
          <div className="doctor-history-wrap"><h3>Riwayat pasien</h3>{historyLoading ? <div className="empty">Memuat riwayat...</div> : history ? <HistoryDetail data={history} compact /> : <div className="empty">Riwayat belum tersedia.</div>}</div>

          <hr/><h3>Pemeriksaan hari ini</h3>
          <form className="stack" onSubmit={saveRecord}>
            <label>Diagnosis<textarea rows={3} required value={diagnosis} onChange={e => setDiagnosis(e.target.value)} /></label>
            <label>Catatan/Tindakan<textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} /></label>
            <button className="primary">Simpan rekam medis</button>
          </form>

          <hr/><h3>Kirim resep ke Apotek</h3>
          <div className="form-grid">
            <label>Obat<select value={medicationId} onChange={e => setMedicationId(e.target.value)}><option value="">Pilih obat</option>{meds.map(m => <option value={m.id} key={m.id}>{m.name} · stok {m.total_stock} {m.unit}</option>)}</select></label>
            <label>Qty<input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} /></label>
            <button type="button" className="secondary span2" onClick={sendPrescription}>Kirim resep</button>
          </div>

          <hr/><h3>Kirim surat ke Administrasi</h3>
          <div className="stack doctor-letter-form">
            <label>Diagnosis pada surat<textarea rows={2} required value={diagnosis} onChange={e => setDiagnosis(e.target.value)} /><small>Diagnosis ini sama dengan diagnosis pemeriksaan dan akan dicetak pada Surat Dokter.</small></label>
            <label>Judul surat<input value={letterTitle} onChange={e => setLetterTitle(e.target.value)} /></label>
            <label>Isi surat<textarea rows={4} value={letterContent} onChange={e => setLetterContent(e.target.value)} /></label>
            <div className="form-grid"><label>Istirahat mulai<input type="date" value={restStartDate} onChange={e => setRestStartDate(e.target.value)} /></label><label>Sampai<input type="date" value={restEndDate} onChange={e => setRestEndDate(e.target.value)} /></label></div>
            <button type="button" className="secondary" onClick={sendLetter}>Kirim surat + diagnosis + QR</button>
          </div>
        </>}
      </section>
    </div>
  </>;
}
