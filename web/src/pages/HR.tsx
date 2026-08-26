import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api, assetUrl, Branch, getUser } from '../lib/api';

type Emp = {
  id:number;
  employee_code:string;
  full_name:string;
  employee_type:string;
  branch_id:number;
  branch_name?:string;
  specialization?:string;
  sip_number?:string;
  biography?:string;
  photo_url?:string;
  show_on_public?:boolean;
  doctor_id?:number;
};

const blankForm = {
  branchId:'', employeeCode:'', fullName:'', employeeType:'OTHER', username:'', password:'',
  specialization:'', sipNumber:'', biography:'', showOnPublic:false,
};

export default function HR(){
 const user=getUser();
 const isAdmin=user?.roles.includes('ADMIN')??false;
 const [rows,setRows]=useState<Emp[]>([]),[branches,setBranches]=useState<Branch[]>([]),[msg,setMsg]=useState('');
 const [form,setForm]=useState(blankForm);
 const [branchForm,setBranchForm]=useState({code:'',name:'',address:'',phone:''});
 const doctors=useMemo(()=>rows.filter(r=>r.doctor_id),[rows]);

 const load=async()=>{
   try{
     const [emps,bs]=await Promise.all([api<Emp[]>('/hr/employees'),api<Branch[]>('/branches')]);
     setRows(emps);setBranches(bs);
     setForm(prev=>({...prev,branchId:prev.branchId || String(isAdmin ? (bs[0]?.id??'') : (user?.branchId??''))}));
   }catch(e){setMsg(e instanceof Error?e.message:'Gagal memuat HR');}
 };
 useEffect(()=>{void load();},[]);

 async function submit(e:FormEvent){
   e.preventDefault();setMsg('');
   try{
     const branchId=isAdmin?Number(form.branchId):user?.branchId;
     await api('/hr/employees',{method:'POST',body:JSON.stringify({
       ...form,
       branchId,
       username:form.username||undefined,
       password:form.password||undefined,
       roles:form.employeeType==='OTHER'?[]:[form.employeeType],
     })});
     setForm({...blankForm,branchId:String(isAdmin?(branches[0]?.id??''):(user?.branchId??''))});
     await load();setMsg('Pegawai berhasil ditambahkan.');
   }catch(e){setMsg(e instanceof Error?e.message:'Gagal');}
 }

 async function addBranch(e:FormEvent){
   e.preventDefault();
   try{
     await api('/branches',{method:'POST',body:JSON.stringify(branchForm)});
     setBranchForm({code:'',name:'',address:'',phone:''});
     await load();setMsg('Cabang berhasil ditambahkan.');
   }catch(e){setMsg(e instanceof Error?e.message:'Gagal menambah cabang');}
 }

 async function uploadPhoto(doctorId:number,file?:File){
   if(!file)return;
   if(file.size>5*1024*1024){setMsg('Foto maksimal 5 MB.');return;}
   try{
     const dataUrl=await new Promise<string>((resolve,reject)=>{
       const reader=new FileReader();
       reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Gagal membaca foto'));
       reader.readAsDataURL(file);
     });
     const dataBase64=dataUrl.split(',')[1]||'';
     await api(`/hr/doctors/${doctorId}/photo`,{method:'POST',body:JSON.stringify({mimeType:file.type,dataBase64})});
     await load();setMsg('Foto dokter berhasil diperbarui.');
   }catch(e){setMsg(e instanceof Error?e.message:'Gagal upload foto');}
 }

 async function togglePublic(d:Emp){
   if(!d.doctor_id)return;
   try{
     await api(`/hr/doctors/${d.doctor_id}/public`,{method:'PATCH',body:JSON.stringify({showOnPublic:!d.show_on_public})});
     await load();
   }catch(e){setMsg(e instanceof Error?e.message:'Gagal mengubah status publik');}
 }

 return <>
  <header className="page-head"><div><small>HUMAN RESOURCES</small><h1>Pegawai, Dokter & Cabang</h1><p>Staff mengikuti cabang akun. ADMIN dapat mengelola seluruh cabang.</p></div></header>
  {msg&&<div className="alert">{msg}</div>}

  <div className="two-col">
   <section className="panel"><div className="panel-title"><h2>Tambah pegawai</h2></div><form className="form-grid" onSubmit={submit}>
    {isAdmin?<label>Cabang<select required value={form.branchId} onChange={e=>setForm({...form,branchId:e.target.value})}><option value="">Pilih cabang</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>:<label>Cabang<input disabled value={user?.branchName||''}/></label>}
    <label>Kode pegawai<input required value={form.employeeCode} onChange={e=>setForm({...form,employeeCode:e.target.value})}/></label>
    <label>Nama lengkap<input required value={form.fullName} onChange={e=>setForm({...form,fullName:e.target.value})}/></label>
    <label>Jabatan<select value={form.employeeType} onChange={e=>setForm({...form,employeeType:e.target.value})}><option>OTHER</option><option>DOCTOR</option><option>NURSE</option><option>PHARMACY</option>{isAdmin&&<option>ADMIN</option>}<option>FINANCE</option><option>HR</option></select></label>
    <label>Username <small>(opsional)</small><input value={form.username} onChange={e=>setForm({...form,username:e.target.value})}/></label>
    <label>Password <small>(min. 8 karakter)</small><input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></label>
    {form.employeeType==='DOCTOR'&&<>
      <label>Spesialisasi<input value={form.specialization} onChange={e=>setForm({...form,specialization:e.target.value})}/></label>
      <label>No. SIP<input value={form.sipNumber} onChange={e=>setForm({...form,sipNumber:e.target.value})}/></label>
      <label className="span2">Biografi singkat<textarea rows={3} value={form.biography} onChange={e=>setForm({...form,biography:e.target.value})}/></label>
      <label className="check span2"><input type="checkbox" checked={form.showOnPublic} onChange={e=>setForm({...form,showOnPublic:e.target.checked})}/> Tampilkan dokter di landing page</label>
    </>}
    <button className="primary span2">Simpan pegawai</button>
   </form></section>

   <div>
    {isAdmin&&<section className="panel"><div className="panel-title"><h2>Tambah cabang</h2></div><form className="form-grid" onSubmit={addBranch}>
      <label>Kode cabang<input required placeholder="BIM02" value={branchForm.code} onChange={e=>setBranchForm({...branchForm,code:e.target.value})}/></label>
      <label>Nama cabang<input required placeholder="BIM CLINICS Bandung" value={branchForm.name} onChange={e=>setBranchForm({...branchForm,name:e.target.value})}/></label>
      <label className="span2">Alamat<input value={branchForm.address} onChange={e=>setBranchForm({...branchForm,address:e.target.value})}/></label>
      <label>No. telepon<input value={branchForm.phone} onChange={e=>setBranchForm({...branchForm,phone:e.target.value})}/></label>
      <button className="secondary">Tambah cabang</button>
    </form></section>}
    <section className="panel"><div className="panel-title"><h2>Akses cabang</h2></div><div className="note">
      <b>ADMIN</b><p>Dapat melihat dan memilih seluruh cabang.</p>
      <b>Staff biasa</b><p>Registrasi, dokter, apotek, finance, dan HR otomatis dibatasi ke cabang akun yang login.</p>
      <b>Dokter publik</b><p>Foto dan profil dokter dapat ditampilkan sebagai card pada landing page.</p>
    </div></section>
   </div>
  </div>

  <section className="panel"><div className="panel-title"><div><h2>Dokter</h2><p>Kelola foto dan visibilitas landing page.</p></div></div>
   {doctors.length===0?<div className="empty">Belum ada dokter.</div>:<div className="hr-doctor-grid">{doctors.map(d=><article className="hr-doctor-card" key={d.id}>
     <div className="hr-doctor-photo">{d.photo_url?<img src={assetUrl(d.photo_url)} alt={d.full_name}/>:<span>{d.full_name.slice(0,1).toUpperCase()}</span>}</div>
     <div className="hr-doctor-body">
       <small>{d.branch_name||'-'}</small><h3>{d.full_name}</h3><p>{d.specialization||'Dokter'}</p>
       <div className="doctor-meta"><span>SIP</span><b>{d.sip_number||'-'}</b></div>
       <label className="photo-upload">Ganti foto<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>void uploadPhoto(d.doctor_id!,e.target.files?.[0])}/></label>
       <button className={d.show_on_public?'secondary':'ghost-light'} onClick={()=>void togglePublic(d)}>{d.show_on_public?'Tampil di landing':'Sembunyikan dari landing'}</button>
     </div>
   </article>)}</div>}
  </section>

  <section className="panel"><div className="panel-title"><h2>Daftar pegawai</h2></div><div className="table-wrap"><table><thead><tr><th>Kode</th><th>Nama</th><th>Cabang</th><th>Jabatan</th><th>Dokter</th><th>Publik</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.employee_code}</td><td>{r.full_name}</td><td>{r.branch_name||'-'}</td><td><span className="pill">{r.employee_type}</span></td><td>{r.specialization||'-'}</td><td>{r.doctor_id?(r.show_on_public?'Ya':'Tidak'):'-'}</td></tr>)}</tbody></table></div></section>
 </>
}
