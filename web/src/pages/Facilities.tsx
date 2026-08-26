import { useEffect, useState } from 'react';
import { api, assetUrl } from '../lib/api';
import PublicNav from '../components/PublicNav';
import PublicFooter from '../components/PublicFooter';
import { fallbackSettings, type SiteSettings } from './Landing';

type Facility = {
  id: number;
  title: string;
  description?: string | null;
  image_url?: string | null;
};

export default function Facilities() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [settings, setSettings] = useState<SiteSettings>(fallbackSettings);

  useEffect(() => {
    const controller = new AbortController();
    void api<Facility[]>('/settings/facilities/public', { signal: controller.signal })
      .then(setFacilities)
      .catch(() => setFacilities([]))
      .finally(() => setLoaded(true));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void api<SiteSettings>('/settings/public', { signal: controller.signal })
      .then((d) => setSettings({ ...fallbackSettings, ...d }))
      .catch(() => setSettings(fallbackSettings));
    return () => controller.abort();
  }, []);

  return (
    <div className="landing-page">
      <PublicNav onLanding={false} />

      <main>
        <section className="public-section" id="facilities-page">
          <div className="section-heading">
            <span>Fasilitas</span>
            <h2>Fasilitas BIM CLINICS</h2>
            <p>Sarana yang kami sediakan untuk kenyamanan dan kelancaran pelayanan pasien di setiap cabang.</p>
          </div>
          {!loaded ? (
            <div className="public-empty">Memuat daftar fasilitas…</div>
          ) : facilities.length === 0 ? (
            <div className="public-empty">Daftar fasilitas akan tampil di sini setelah ditambahkan dari menu Pengaturan.</div>
          ) : (
            <div className="service-grid">
              {facilities.map((f, i) => (
                <article key={f.id} className={f.image_url ? 'facility-card has-photo' : 'facility-card'}>
                  {f.image_url ? (
                    <div className="facility-photo"><img src={assetUrl(f.image_url)} alt={f.title} loading="lazy" /></div>
                  ) : (
                    <div className="service-icon">{String(i + 1).padStart(2, '0')}</div>
                  )}
                  <div className="facility-card-body">
                    <h3>{f.title}</h3>
                    {f.description && <p>{f.description}</p>}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
      <PublicFooter tagline={settings.footer_tagline} />
    </div>
  );
}
