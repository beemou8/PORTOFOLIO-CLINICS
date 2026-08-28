import { useEffect, useState } from 'react';
import { api, assetUrl } from '../lib/api';
import PublicNav from '../components/PublicNav';
import PublicFooter from '../components/PublicFooter';

type PublicDoctor = {
  doctor_id: number;
  full_name: string;
  specialization?: string | null;
  biography?: string | null;
  photo_url?: string | null;
  branch_name?: string | null;
};

type PublicFacility = {
  id: number;
  title: string;
  description?: string | null;
  image_url?: string | null;
};

export type SiteSettings = {
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

export const fallbackSettings: SiteSettings = {
  hero_eyebrow: 'BIM CLINICS',
  hero_title: 'Pelayanan kesehatan yang dekat, jelas, dan terpercaya.',
  hero_subtitle: 'Konsultasi dokter, layanan apotek, serta dokumen medis yang dapat diverifikasi secara digital.',
  hero_image_url: null,
  about_title: 'Tentang Kami',
  about_content: 'BIM CLINICS adalah klinik yang berkomitmen memberikan pelayanan kesehatan yang cepat, jelas, dan dapat dipercaya bagi masyarakat.',
  contact_phone: '+620000000000',
  contact_address: null,
  footer_tagline: 'Pelayanan kesehatan terintegrasi.',
};

export default function Landing() {
  const [doctors, setDoctors] = useState<PublicDoctor[]>([]);
  const [doctorsLoaded, setDoctorsLoaded] = useState(false);
  const [facilities, setFacilities] = useState<PublicFacility[]>([]);
  const [facilitiesLoaded, setFacilitiesLoaded] = useState(false);
  const [settings, setSettings] = useState<SiteSettings>(fallbackSettings);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 2500);
    void api<PublicDoctor[]>('/doctors/public', { signal: controller.signal })
      .then(setDoctors)
      .catch(() => setDoctors([]))
      .finally(() => { window.clearTimeout(timeout); setDoctorsLoaded(true); });
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void api<PublicFacility[]>('/settings/facilities/public', { signal: controller.signal })
      .then(setFacilities)
      .catch(() => setFacilities([]))
      .finally(() => setFacilitiesLoaded(true));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void api<SiteSettings>('/settings/public', { signal: controller.signal })
      .then((d) => setSettings({ ...fallbackSettings, ...d }))
      .catch(() => setSettings(fallbackSettings));
    return () => controller.abort();
  }, []);

  const heroStyle = settings.hero_image_url
    ? { backgroundImage: `linear-gradient(rgba(16,35,30,.72),rgba(16,35,30,.72)), url(${assetUrl(settings.hero_image_url)})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : undefined;

  return (
    <div className="landing-page">
      <PublicNav />

      <main>
        <section className={`hero${settings.hero_image_url ? ' has-image' : ''}`} id="home" style={heroStyle}>
          <div className="hero-copy"><span className="eyebrow">{settings.hero_eyebrow}</span><h1>{settings.hero_title}</h1><p>{settings.hero_subtitle}</p><div className="hero-actions"><a className="public-primary" href="#doctors">Lihat Dokter</a><a className="public-secondary" href="#services">Layanan Kami</a></div><div className="trust-row"><span><b>✓</b> Dokter terdaftar</span><span><b>✓</b> Resep terintegrasi</span><span><b>✓</b> Surat ber-QR</span></div></div>
          <div className="hero-card"><span className="hero-card-label">BIM CLINICS</span><div className="medical-cross">+</div><h3>Satu sistem, satu riwayat pelayanan.</h3><p>Mulai dari registrasi, pemeriksaan dokter, resep apotek hingga verifikasi surat medis.</p></div>
        </section>

        <section className="public-section" id="services"><div className="section-heading"><span>Layanan</span><h2>Pelayanan utama BIM CLINICS</h2><p>Dirancang agar alur pasien lebih sederhana dari pendaftaran sampai selesai berobat.</p></div><div className="service-grid"><article><div className="service-icon">01</div><h3>Konsultasi Dokter</h3><p>Pemeriksaan dan pencatatan kunjungan pasien secara terintegrasi.</p></article><article><div className="service-icon">02</div><h3>Apotek</h3><p>Resep dokter langsung diteruskan ke apotek dengan pengelolaan stok obat.</p></article><article><div className="service-icon">03</div><h3>Surat Medis QR</h3><p>Dokumen medis BIM CLINICS dapat diverifikasi melalui QR resmi.</p></article></div></section>

        <section className="public-section facilities-section" id="facilities"><div className="section-heading"><span>Fasilitas</span><h2>Fasilitas BIM CLINICS</h2><p>Sarana pendukung pelayanan pasien sekarang dapat dilihat langsung dari halaman utama.</p></div>{!facilitiesLoaded?<div className="public-empty">Memuat daftar fasilitas…</div>:facilities.length===0?<div className="public-empty">Daftar fasilitas akan tampil di sini setelah ditambahkan dari menu Pengaturan.</div>:<div className="service-grid facility-grid">{facilities.map((f,i)=><article key={f.id} className={f.image_url?'facility-card has-photo':'facility-card'}>{f.image_url?<div className="facility-photo"><img src={assetUrl(f.image_url)} alt={f.title} loading="lazy"/></div>:<div className="service-icon">{String(i+1).padStart(2,'0')}</div>}<div className="facility-card-body"><h3>{f.title}</h3>{f.description&&<p>{f.description}</p>}</div></article>)}</div>}</section>

        <section className="public-section doctors-section" id="doctors"><div className="section-heading"><span>Dokter</span><h2>Dokter BIM CLINICS</h2><p>Dokter yang ditandai publik oleh HR otomatis tampil di sini.</p></div>{!doctorsLoaded?<div className="public-empty">Memuat daftar dokter…</div>:doctors.length===0?<div className="public-empty">Profil dokter akan tampil di sini setelah ditambahkan oleh HR.</div>:<div className="doctor-grid">{doctors.map(d=><article className="doctor-card" key={d.doctor_id}><div className="doctor-photo">{d.photo_url?<img src={assetUrl(d.photo_url)} alt={d.full_name}/>:<span>{d.full_name.slice(0,1).toUpperCase()}</span>}</div><div className="doctor-info"><span>{d.specialization||'Dokter'}</span><h3>{d.full_name}</h3><small>{d.branch_name||'BIM CLINICS'}</small>{d.biography&&<p>{d.biography}</p>}</div></article>)}</div>}</section>

        <section className="public-section" id="about"><div className="section-heading"><span>Profil</span><h2>{settings.about_title}</h2><p>{settings.about_content}</p>{settings.contact_address && <p>{settings.contact_address}</p>}</div></section>

        <section className="public-cta" id="contact"><div><span>BIM CLINICS</span><h2>Butuh informasi klinik?</h2><p>Hubungi BIM CLINICS untuk jadwal pelayanan, dokter, dan informasi kunjungan.</p></div><a className="public-secondary light" href={`tel:${settings.contact_phone}`}>Hubungi Klinik</a></section>
      </main>
      <PublicFooter tagline={settings.footer_tagline} />
    </div>
  );
}
