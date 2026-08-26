import { FormEvent, useEffect, useState } from 'react';
import { api, Branch, getUser } from '../lib/api';

type Doctor={doctor_id:number;full_name:string;specialization?:string;branch_id:number};
export default function Registration(){
 const user=getUser();const isAdmin=user?.roles.includes('ADMIN')??false;
 const [doctors,setDoctors]=useState<Doctor[]>([]),[branches,setBranches]=useState<Branch[]>([]),[branchId,setBranchId]=useState(String(user?.branchId??'')),[msg,setMsg]=useState('');
 const [f,setF]=useState({fullName:'',nik:'',phone:'',complaint:'',doctorId:''});

 useEffect(()=>{void api<Branch[]>('/branches').then(bs=>{setBranches(bs);if(isAdmin&&!branchId&&bs[0])setBranchId(String(bs[0].id));}).catch(()=>{})},[]);
 useEffect(()=>{if(!branchId){setDoctors([]);return;}void api<Doctor[]>(`/doctors?branchId=${branchId}`).then(setDoctors).catch(()=>setDoctors([]));setF(x=>({...x,doctorId:''}));},[branchId]);

 async function submit(e:FormEvent){e.preventDefault();setMsg('');try{
   const p=await api<any>('/patients',{method:'POST',body:JSON.stringify({fullName:f.fullName,nik:f.nik||null,phone:f.phone||null})});
   const v=await api<any>('/visits',{method:'POST',body:JSON.stringify({branchId:Number(branchId),patientId:Number(p.id),doctorId:f.doctorId?Number(f.doctorId):null,complaint:f.complaint})});
   setMsg(`${p.is_existing?'Pasien lama terdeteksi. ':''}Registrasi berhasil: ${v.registration_no}${p.is_existing?` · Riwayat tetap terhubung ke ${p.medical_record_no}`:''}`);setF({fullName:'',nik:'',phone:'',complaint:'',doctorId:''});
 }catch(e){setMsg(e instanceof Error?e.message:'Gagal');}}
 return <><header className="page-head"><div><small>FRONT OFFICE</small><h1>Registrasi Pasien</h1><p>{isAdmin?'Pilih cabang tujuan kunjungan.':'Kunjungan otomatis masuk ke '+(user?.branchName||'cabang akun Anda')+'.'}</p></div></header>{msg&&<div className="alert">{msg}</div>}<section className="panel narrow"><form className="form-grid" onSubmit={submit}>
   {isAdmin?<label>Cabang<select required value={branchId} onChange={e=>setBranchId(e.target.value)}><option value="">Pilih cabang</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>:<label>Cabang<input disabled value={user?.branchName||''}/></label>}
   <label>Nama pasien<input required value={f.fullName} onChange={e=>setF({...f,fullName:e.target.value})}/></label>
   <label>NIK<input value={f.nik} onChange={e=>setF({...f,nik:e.target.value})}/></label><label>No. HP<input value={f.phone} onChange={e=>setF({...f,phone:e.target.value})}/></label>
   <label>Dokter<select value={f.doctorId} onChange={e=>setF({...f,doctorId:e.target.value})}><option value="">Belum ditentukan</option>{doctors.map(d=><option value={d.doctor_id} key={d.doctor_id}>{d.full_name} {d.specialization?`- ${d.specialization}`:''}</option>)}</select></label>
   <label className="span2">Keluhan<textarea rows={4} value={f.complaint} onChange={e=>setF({...f,complaint:e.target.value})}/></label><button className="primary span2">Daftarkan pasien</button>
 </form></section></>
}
