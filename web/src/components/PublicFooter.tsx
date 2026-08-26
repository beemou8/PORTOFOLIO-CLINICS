export default function PublicFooter({ tagline }: { tagline: string }) {
  return (
    <footer className="public-footer"><b>BIM CLINICS</b><span>{tagline}</span></footer>
  );
}
