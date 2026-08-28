import { Link } from 'react-router-dom';

export default function PublicNav({ onLanding = true }: { onLanding?: boolean }) {
  const anchor = (id: string) => (onLanding ? `#${id}` : `/#${id}`);
  return (
    <header className="public-nav">
      <Link className="public-brand" to="/" aria-label="BIM CLINICS"><span>+</span><b>BIM CLINICS</b></Link>
      <nav>
        <a href={anchor('home')}>Beranda</a>
        <a href={anchor('services')}>Layanan</a>
        <a href={anchor('facilities')}>Fasilitas</a>
        <a href={anchor('doctors')}>Dokter</a>
        <a href={anchor('about')}>Tentang</a>
        <a href={anchor('contact')}>Kontak</a>
      </nav>
    </header>
  );
}
