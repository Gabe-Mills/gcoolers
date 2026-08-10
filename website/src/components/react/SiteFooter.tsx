import { site } from "../../data/site";

/** Restrained by design: who made it, where the code is, how to get help. */
export default function SiteFooter({ home = false }: { home?: boolean }) {
  return (
    <footer className="foot">
      <div className="wrap foot-row">
        <span className="foot-brand">
          {site.name}
          <em>Gabe Mills</em>
        </span>
        <nav className="foot-links" aria-label="Footer">
          {!home && <a href="/">Home</a>}
          <a href={site.github} target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          <a href="/support">Support</a>
          <a href={`mailto:${site.email}`}>Email</a>
          <a href={site.license} target="_blank" rel="noopener noreferrer">
            MIT
          </a>
        </nav>
      </div>
    </footer>
  );
}
