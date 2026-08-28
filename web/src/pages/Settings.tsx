import { FormEvent, useEffect, useState } from 'react';
import { api, assetUrl } from '../lib/api';

type SiteSettings = {
  hero_eyebrow: string;
  hero_title: string;
  hero_subtitle: string;
  hero_image_url: string | null;
  about_title: string;
  about_content: string;
  contact_phone: string;
  contact_address: string | null;
  footer_tagline: string;
};

type Facility = {
  id: number;
  title: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
};

const blank: SiteSettings = {
  hero_eyebrow: '', hero_title: '', hero_subtitle: '', hero_image_url: null,
  about_title: '', about_content: '',
  contact_phone: '', contact_address: '', footer_tagline: '',
};

const blankFacility = { title: '', description: '', sortOrder: 0 };
type SectionKey = 'hero' | 'about' | 'contact' | 'facilities' | null;

export default function Settings() {
  const [saved, setSaved] = useState<SiteSettings>(blank);
  const [form, setForm] = useState<SiteSettings>(blank);
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);
  const [openSection, setOpenSection] = useState<SectionKey>(null);

  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [facilitiesLoaded, setFacilitiesLoaded] = useState(false);
  const [newFacility, setNewFacility] = useState(blankFacility);
  const [newFacilityImage, setNewFacilityImage] = useState<File | null>(null);
  const [showAddFacility, setShowAddFacility] = useState(false);
  const [editingFacilityId, setEditingFacilityId] = useState<number | null>(null);
  const [uploadingFacilityId, setUploadingFacilityId] = useState<number | 'new' | null>(null);
  const [fMsg, setFMsg] = useState('');

  const load = () => api<SiteSettings>('/settings')
    .then((d) => { setSaved({ ...blank, ...d }); setForm({ ...blank, ...d }); })
    .catch((e) => setMsg(e.message));

  const loadFacilities = () => api<Facility[]>('/settings/facilities')
    .then((items) => { setFacilities(items); setFacilitiesLoaded(true); })
    .catch((e) => { setFMsg(e.message); setFacilitiesLoaded(true); });

  useEffect(() => { void load(); }, []);

  function chooseSection(key: Exclude<SectionKey, null>) {
    setMsg('');
    setFMsg('');
    setForm(saved);
    setEditingFacilityId(null);
    setShowAddFacility(false);
    setOpenSection((cur) => cur === key ? null : key);
    if (key === 'facilities' && !facilitiesLoaded) void loadFacilities();
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg('');
    setSaving(true);
    try {
      const updated = await api<SiteSettings>('/settings', {
        method: 'PUT',
        body: JSON.stringify({
          heroEyebrow: form.hero_eyebrow,
          heroTitle: form.hero_title,
          heroSubtitle: form.hero_subtitle,
          aboutTitle: form.about_title,
          aboutContent: form.about_content,
          contactPhone: form.contact_phone,
          contactAddress: form.contact_address,
          footerTagline: form.footer_tagline,
        }),
      });
      setSaved({ ...blank, ...updated });
      setForm({ ...blank, ...updated });
      setMsg('Perubahan berhasil disimpan.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal menyimpan pengaturan');
    } finally {
      setSaving(false);
    }
  }

  async function imagePayload(file: File) {
    if (file.size > 5 * 1024 * 1024) throw new Error('Ukuran foto maksimal 5 MB.');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Foto harus JPG, PNG, atau WEBP.');
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Gagal membaca foto'));
      reader.readAsDataURL(file);
    });
    return { mimeType: file.type, dataBase64: dataUrl.split(',')[1] || '' };
  }

  async function uploadHeroImage(file?: File) {
    if (!file) return;
    setUploadingHero(true);
    setMsg('');
    try {
      const payload = await imagePayload(file);
      const updated = await api<SiteSettings>('/settings/hero-image', {
        method: 'POST', body: JSON.stringify(payload),
      });
      setSaved((s) => ({ ...s, hero_image_url: updated.hero_image_url }));
      setForm((f) => ({ ...f, hero_image_url: updated.hero_image_url }));
      setMsg('Foto latar hero berhasil diperbarui.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal mengunggah foto');
    } finally {
      setUploadingHero(false);
    }
  }

  async function addFacility(e: FormEvent) {
    e.preventDefault();
    setFMsg('');
    setUploadingFacilityId('new');
    try {
      const created = await api<Facility>('/settings/facilities', { method: 'POST', body: JSON.stringify(newFacility) });
      let photoWarning = '';
      if (newFacilityImage) {
        try {
          const payload = await imagePayload(newFacilityImage);
          await api<Facility>(`/settings/facilities/${created.id}/image`, { method: 'POST', body: JSON.stringify(payload) });
        } catch (error) {
          photoWarning = error instanceof Error ? error.message : 'Foto gagal diunggah.';
        }
      }
      setNewFacility({ ...blankFacility, sortOrder: facilities.length + 1 });
      setNewFacilityImage(null);
      setShowAddFacility(false);
      await loadFacilities();
      setFMsg(photoWarning
        ? `Fasilitas ditambahkan, tetapi foto gagal: ${photoWarning}`
        : newFacilityImage ? 'Fasilitas dan foto berhasil ditambahkan.' : 'Fasilitas berhasil ditambahkan.');
    } catch (e) {
      setFMsg(e instanceof Error ? e.message : 'Gagal menambah fasilitas');
    } finally {
      setUploadingFacilityId(null);
    }
  }

  async function uploadFacilityImage(id: number, file?: File) {
    if (!file) return;
    setFMsg('');
    setUploadingFacilityId(id);
    try {
      const payload = await imagePayload(file);
      const updated = await api<Facility>(`/settings/facilities/${id}/image`, { method: 'POST', body: JSON.stringify(payload) });
      setFacilities((items) => items.map((item) => item.id === id ? { ...item, image_url: updated.image_url } : item));
      setFMsg('Foto fasilitas berhasil diperbarui.');
    } catch (e) {
      setFMsg(e instanceof Error ? e.message : 'Gagal mengunggah foto fasilitas');
    } finally {
      setUploadingFacilityId(null);
    }
  }

  async function removeFacilityImage(id: number) {
    if (!confirm('Hapus foto fasilitas ini?')) return;
    setFMsg('');
    setUploadingFacilityId(id);
    try {
      await api<Facility>(`/settings/facilities/${id}/image`, { method: 'DELETE' });
      setFacilities((items) => items.map((item) => item.id === id ? { ...item, image_url: null } : item));
      setFMsg('Foto fasilitas dihapus.');
    } catch (e) {
      setFMsg(e instanceof Error ? e.message : 'Gagal menghapus foto fasilitas');
    } finally {
      setUploadingFacilityId(null);
    }
  }

  async function saveFacility(f: Facility) {
    setFMsg('');
    try {
      await api(`/settings/facilities/${f.id}`, {
        method: 'PUT',
        body: JSON.stringify({ title: f.title, description: f.description, sortOrder: f.sort_order }),
      });
      setEditingFacilityId(null);
      await loadFacilities();
      setFMsg('Perubahan fasilitas disimpan.');
    } catch (e) {
      setFMsg(e instanceof Error ? e.message : 'Gagal menyimpan fasilitas');
    }
  }

  async function toggleFacilityActive(f: Facility) {
    setFMsg('');
    try {
      await api(`/settings/facilities/${f.id}/active`, { method: 'PATCH', body: JSON.stringify({ isActive: !f.is_active }) });
      await loadFacilities();
      setFMsg(f.is_active ? 'Fasilitas disembunyikan dari landing page.' : 'Fasilitas ditampilkan di landing page.');
    } catch (e) {
      setFMsg(e instanceof Error ? e.message : 'Gagal mengubah status fasilitas');
    }
  }

  async function deleteFacility(id: number) {
    if (!confirm('Hapus fasilitas ini dari landing page?')) return;
    setFMsg('');
    try {
      await api(`/settings/facilities/${id}`, { method: 'DELETE' });
      await loadFacilities();
      setFMsg('Fasilitas dihapus.');
    } catch (e) {
      setFMsg(e instanceof Error ? e.message : 'Gagal menghapus fasilitas');
    }
  }

  return <>
    <header className="page-head">
      <div>
        <small>PENGATURAN</small>
        <h1>Konten Halaman Publik</h1>
        <p>Pilih bagian yang ingin diatur. Isi pengaturan baru muncul setelah tombol bagiannya dipilih.</p>
      </div>
    </header>

    <section className="settings-menu-grid" aria-label="Menu pengaturan landing page">
      <button type="button" className={`settings-menu-button${openSection === 'hero' ? ' active' : ''}`} onClick={() => chooseSection('hero')}>
        <span>01</span><div><b>Beranda</b><small>Hero, judul dan foto latar</small></div>
      </button>
      <button type="button" className={`settings-menu-button${openSection === 'about' ? ' active' : ''}`} onClick={() => chooseSection('about')}>
        <span>02</span><div><b>Tentang Kami</b><small>Profil singkat klinik</small></div>
      </button>
      <button type="button" className={`settings-menu-button${openSection === 'contact' ? ' active' : ''}`} onClick={() => chooseSection('contact')}>
        <span>03</span><div><b>Kontak & Footer</b><small>Telepon, alamat dan tagline</small></div>
      </button>
      <button type="button" className={`settings-menu-button${openSection === 'facilities' ? ' active' : ''}`} onClick={() => chooseSection('facilities')}>
        <span>04</span><div><b>Fasilitas</b><small>Kelola fasilitas di landing page</small></div>
      </button>
    </section>

    {msg && <div className="alert">{msg}</div>}

    {openSection === 'hero' && <section className="panel settings-detail-panel">
      <div className="panel-title"><div><h2>Beranda (Hero)</h2><p>{saved.hero_title}</p></div></div>
      <div className="stack" style={{ marginBottom: 16 }}>
        <label>Foto latar hero (JPG/PNG/WEBP, maks 5 MB)
          {saved.hero_image_url && <div style={{ margin: '8px 0' }}><img src={assetUrl(saved.hero_image_url)} alt="Foto latar hero" style={{ width: '100%', maxWidth: 320, borderRadius: 10 }} /></div>}
          <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploadingHero} onChange={(e) => void uploadHeroImage(e.target.files?.[0])} />
        </label>
        {uploadingHero && <small>Mengunggah foto…</small>}
      </div>
      <form className="form-grid" onSubmit={submit}>
        <label>Label kecil di atas judul<input required maxLength={80} value={form.hero_eyebrow} onChange={e => setForm({ ...form, hero_eyebrow: e.target.value })} /></label>
        <label className="span2">Judul utama (hero)<input required maxLength={200} value={form.hero_title} onChange={e => setForm({ ...form, hero_title: e.target.value })} /></label>
        <label className="span2">Sub-judul / deskripsi singkat<textarea required rows={2} value={form.hero_subtitle} onChange={e => setForm({ ...form, hero_subtitle: e.target.value })} /></label>
        <button className="primary span2" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan perubahan'}</button>
      </form>
    </section>}

    {openSection === 'about' && <section className="panel settings-detail-panel">
      <div className="panel-title"><div><h2>Tentang Kami</h2><p>{saved.about_title}</p></div></div>
      <form className="form-grid" onSubmit={submit}>
        <label className="span2">Judul bagian "Tentang Kami"<input required maxLength={150} value={form.about_title} onChange={e => setForm({ ...form, about_title: e.target.value })} /></label>
        <label className="span2">Isi "Tentang Kami"<textarea required rows={4} value={form.about_content} onChange={e => setForm({ ...form, about_content: e.target.value })} /></label>
        <button className="primary span2" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan perubahan'}</button>
      </form>
    </section>}

    {openSection === 'contact' && <section className="panel settings-detail-panel">
      <div className="panel-title"><div><h2>Kontak &amp; Footer</h2><p>{saved.contact_phone}</p></div></div>
      <form className="form-grid" onSubmit={submit}>
        <label>No. telepon kontak<input required value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })} /></label>
        <label>Alamat (opsional)<input value={form.contact_address ?? ''} onChange={e => setForm({ ...form, contact_address: e.target.value })} /></label>
        <label className="span2">Tagline footer<input required maxLength={200} value={form.footer_tagline} onChange={e => setForm({ ...form, footer_tagline: e.target.value })} /></label>
        <button className="primary span2" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan perubahan'}</button>
      </form>
    </section>}

    {openSection === 'facilities' && <section className="panel settings-detail-panel">
      <div className="panel-title">
        <div><h2>Fasilitas</h2><p>Fasilitas aktif tampil langsung sebagai bagian dari landing page BIM CLINICS.</p></div>
        <button type="button" className={showAddFacility ? 'ghost' : 'secondary'} onClick={() => setShowAddFacility((v) => !v)}>{showAddFacility ? 'Tutup form' : '+ Tambah fasilitas'}</button>
      </div>
      {fMsg && <div className="alert">{fMsg}</div>}

      {showAddFacility && <form className="form-grid facility-add-form" onSubmit={addFacility}>
        <label>Nama fasilitas<input required maxLength={150} value={newFacility.title} onChange={e => setNewFacility({ ...newFacility, title: e.target.value })} /></label>
        <label>Urutan tampil<input type="number" min={0} value={newFacility.sortOrder} onChange={e => setNewFacility({ ...newFacility, sortOrder: Number(e.target.value) })} /></label>
        <label className="span2">Deskripsi singkat<textarea rows={2} value={newFacility.description} onChange={e => setNewFacility({ ...newFacility, description: e.target.value })} /></label>
        <label className="span2">Foto fasilitas (JPG/PNG/WEBP, maks 5 MB)
          <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploadingFacilityId === 'new'} onChange={(e) => setNewFacilityImage(e.target.files?.[0] ?? null)} />
        </label>
        <button className="primary span2" disabled={uploadingFacilityId === 'new'}>{uploadingFacilityId === 'new' ? 'Menyimpan…' : 'Simpan fasilitas baru'}</button>
      </form>}

      {!facilitiesLoaded ? <div className="empty">Memuat fasilitas...</div> : facilities.length === 0 ? <div className="empty">Belum ada fasilitas ditambahkan.</div> : <div className="stack">
        {facilities.map((f) => <div className="document-card" key={f.id}>
          {editingFacilityId === f.id ? <>
            <div className="form-grid">
              <label>Nama fasilitas<input value={f.title} onChange={e => setFacilities(facilities.map((x) => x.id === f.id ? { ...x, title: e.target.value } : x))} /></label>
              <label>Urutan tampil<input type="number" min={0} value={f.sort_order} onChange={e => setFacilities(facilities.map((x) => x.id === f.id ? { ...x, sort_order: Number(e.target.value) } : x))} /></label>
              <label className="span2">Deskripsi singkat<textarea rows={2} value={f.description ?? ''} onChange={e => setFacilities(facilities.map((x) => x.id === f.id ? { ...x, description: e.target.value } : x))} /></label>
              <label className="span2">Foto fasilitas (JPG/PNG/WEBP, maks 5 MB)
                {f.image_url && <div className="facility-admin-preview"><img src={assetUrl(f.image_url)} alt={f.title} /></div>}
                <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploadingFacilityId === f.id} onChange={(e) => void uploadFacilityImage(f.id, e.target.files?.[0])} />
              </label>
            </div>
            <div className="actions">
              <button type="button" className="primary" onClick={() => void saveFacility(f)}>Simpan</button>
              {f.image_url && <button type="button" className="ghost" disabled={uploadingFacilityId === f.id} onClick={() => void removeFacilityImage(f.id)}>Hapus foto</button>}
              <button type="button" className="ghost" onClick={() => { setEditingFacilityId(null); void loadFacilities(); }}>Batal</button>
            </div>
          </> : <>
            {f.image_url && <div className="facility-admin-thumb"><img src={assetUrl(f.image_url)} alt={f.title} /></div>}
            <div className="document-head"><div><b>{f.title}</b><small>Urutan {f.sort_order}{!f.is_active ? ' · disembunyikan dari landing page' : ' · tampil di landing page'}</small></div></div>
            {f.description && <p>{f.description}</p>}
            <div className="actions">
              <button type="button" className="secondary" onClick={() => setEditingFacilityId(f.id)}>Ubah</button>
              <button type="button" className="ghost" onClick={() => void toggleFacilityActive(f)}>{f.is_active ? 'Sembunyikan' : 'Tampilkan'}</button>
              <button type="button" className="ghost" onClick={() => void deleteFacility(f.id)}>Hapus</button>
            </div>
          </>}
        </div>)}
      </div>}
    </section>}
  </>;
}
