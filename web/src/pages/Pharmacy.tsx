import { FormEvent, useEffect, useState } from 'react';
import { api, Branch, getUser } from '../lib/api';

type Rx={id:number;patient_name:string;doctor_name:string;branch_name?:string;created_at:string;items:any[]};
type Med={id:number;sku:string;name:string;unit:string;total_stock:string};
export default function Pharmacy(){
 const user=getUser();const isAdmin=user?.roles.includes('ADMIN')??false;
 const [branches,setBranches]=useState<Branch[]>([]),[branchId,setBranchId]=useState(String(user?.branchId??''));
 const [rx,setRx]=useState<Rx[]>([]),[meds,setMeds]=useState<Med[]>([]),[msg,setMsg]=useState('');
 const [f,setF]=useState({sku:'',name:'',unit:'tablet',sellPrice:'0'});
 const [batch,setBatch]=useState({medicationId:'',batchNo:'',expiryDate:'',purchasePrice:'0',qty:'0'});

 const load=async()=>{
   try{
     const suffix=isAdmin&&branchId?`?branchId=${branchId}`:'';
     const rxPath=isAdmin&&branchId?`/pharmacy/prescriptions?status=SUBMITTED&branchId=${branchId}`:'/pharmacy/prescriptions?status=SUBMITTED';
     const [r,m]=await Promise.all([api<Rx[]>(rxPath),api<Med[]>(`/pharmacy/medications${suffix}`)]);setRx(r);setMeds(m);
   }catch(e){setMsg(e instanceof Error?e.message:'Gagal memuat apotek');}
 };
 useEffect(()=>{void api<Branch[]>('/branches').then(bs=>{setBranches(bs);if(isAdmin&&!branchId&&bs[0])setBranchId(String(bs[0].id));}).catch(()=>{})},[]);
 useEffect(()=>{void load();},[branchId]);

 async function addMed(e:FormEvent){e.preventDefault();try{await api('/pharmacy/medications',{method:'POST',body:JSON.stringify({...f,sellPrice:Number(f.sellPrice),minStock:0})});setF({sku:'',name:'',unit:'tablet',sellPrice:'0'});setMsg('Master obat ditambahkan.');await load();}catch(e){setMsg(e instanceof Error?e.message:'Gagal');}}
 async function addBatch(e:FormEvent){e.preventDefault();try{await api('/pharmacy/batches',{method:'POST',body:JSON.stringify({medicationId:Number(batch.medicationId),branchId:Number(branchId),batchNo:batch.batchNo,expiryDate:batch.expiryDate,purchasePrice:Number(batch.purchasePrice),qty:Number(batch.qty)})});setBatch({medicationId:'',batchNo:'',expiryDate:'',purchasePrice:'0',qty:'0'});setMsg('Batch masuk dan stok cabang bertambah.');await load();}catch(e){setMsg(e instanceof Error?e.message:'Gagal');}}
 async function dispense(id:number){try{await api(`/pharmacy/prescriptions/${id}/dispense`,{method:'POST'});setMsg('Obat diserahkan dan stok otomatis berkurang FEFO.');await load();}catch(e){setMsg(e instanceof Error?e.message:'Gagal');}}

 return <><header className="page-head"><div><small>PHARMACY</small><h1>Apotek & Stok</h1><p>Stok dan resep otomatis dibatasi sesuai cabang akun.</p></div></header>{msg&&<div className="alert">{msg}</div>}
 {isAdmin&&<section className="panel branch-filter"><label>Cabang yang dilihat<select value={branchId} onChange={e=>setBranchId(e.target.value)}>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label></section>}
 <div className="two-col"><section className="panel"><div className="panel-title"><h2>Resep masuk</h2></div>{rx.length===0?<div className="empty">Tidak ada resep menunggu.</div>:rx.map(r=><div className="rx" key={r.id}><div><b>{r.patient_name}</b><small>Dokter: {r.doctor_name}{r.branch_name?` · ${r.branch_name}`:''}</small></div><ul>{r.items.map(i=><li key={i.itemId}>{i.medication} — {i.qty}</li>)}</ul><button className="primary" onClick={()=>void dispense(r.id)}>Serahkan obat</button></div>)}</section><div><section className="panel"><div className="panel-title"><h2>Tambah master obat</h2></div><form className="form-grid" onSubmit={addMed}><label>SKU<input required value={f.sku} onChange={e=>setF({...f,sku:e.target.value})}/></label><label>Nama obat<input required value={f.name} onChange={e=>setF({...f,name:e.target.value})}/></label><label>Satuan<input required value={f.unit} onChange={e=>setF({...f,unit:e.target.value})}/></label><label>Harga jual<input type="number" min="0" value={f.sellPrice} onChange={e=>setF({...f,sellPrice:e.target.value})}/></label><button className="secondary span2">Tambah obat</button></form></section><section className="panel"><div className="panel-title"><h2>Stok masuk / batch</h2><p>{isAdmin?branches.find(b=>String(b.id)===branchId)?.name:user?.branchName}</p></div><form className="form-grid" onSubmit={addBatch}><label>Obat<select required value={batch.medicationId} onChange={e=>setBatch({...batch,medicationId:e.target.value})}><option value="">Pilih obat</option>{meds.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label><label>No. Batch<input required value={batch.batchNo} onChange={e=>setBatch({...batch,batchNo:e.target.value})}/></label><label>Expired<input required type="date" value={batch.expiryDate} onChange={e=>setBatch({...batch,expiryDate:e.target.value})}/></label><label>Harga beli<input required type="number" min="0" value={batch.purchasePrice} onChange={e=>setBatch({...batch,purchasePrice:e.target.value})}/></label><label>Qty masuk<input required type="number" min="0.01" step="0.01" value={batch.qty} onChange={e=>setBatch({...batch,qty:e.target.value})}/></label><button className="secondary">Tambah stok</button></form><div className="mini-list">{meds.map(m=><div key={m.id}><span><b>{m.name}</b><small>{m.sku}</small></span><strong>{m.total_stock} {m.unit}</strong></div>)}</div></section></div></div></>
}
