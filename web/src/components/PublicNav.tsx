import { Link } from 'react-router-dom';

// Item selain "Fasilitas" tetap anchor ke section landing page. Kalau sedang tidak
// berada di landing page (mis. di /fasilitas), "/#id" akan membawa user kembali ke
// beranda lalu browser otomatis scroll ke section terkait.
export default function PublicNav({ onLanding = true }: { onLanding?: boolean }) {
  const anchor = (id: string) => (onLanding ? `#${id}` : `/#${id}`);
  return (
    <header className="public-nav">
      <Link className="public-brand" to="/" aria-label="BIM CLINICS"><span>+</span><b>BIM CLINICS</b></Link>
      <nav>
        <a href={anchor('home')}>Beranda</a>
        <a href={anchor('services')}>Layanan</a>
        <Link to="/fasilitas">Fasilitas</Link>
        <a href={anchor('doctors')}>Dokter</a>
        <a href={anchor('about')}>Tentang</a>
        <a href={anchor('contact')}>Kontak</a>
      </nav>
    </header>
  );
}
