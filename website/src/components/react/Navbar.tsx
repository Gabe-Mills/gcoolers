import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { nav, site } from "../../data/site";

export function GMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round">
        <path d="M19.5 7.2A9 9 0 1 0 21 12h-7.5" />
      </svg>
    </span>
  );
}

interface Props {
  /** Delays the reveal until the boot sequence clears. */
  ready?: boolean;
  path?: string;
}

/**
 * Navigation.
 *
 * Nearly invisible over the hero and glassy only once you've scrolled past it.
 * Section links are hidden below the breakpoint rather than collapsed into a
 * menu — three anchors and an install button do not need a drawer, and a drawer
 * is one more thing to trap focus in.
 */
export default function Navbar({ ready = true, path = "/" }: Props) {
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      // Coalesced into a frame so a fast scroll cannot queue a state write per event.
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setStuck(window.scrollY > 24);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <motion.header
      className={`nav${stuck ? " is-stuck" : ""}`}
      initial={{ opacity: 0, y: -16 }}
      animate={ready ? { opacity: 1, y: 0 } : { opacity: 0, y: -16 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: ready ? 0.15 : 0 }}
    >
      <div className="wrap nav-inner">
        <a className="brand" href="/">
          <GMark />
          {site.name}
        </a>

        <nav aria-label="Primary">
          <ul className="nav-links">
            {nav.map((item) => (
              <li key={item.href} className="hide-sm">
                <a href={item.href}>{item.label}</a>
              </li>
            ))}
            <li className="hide-sm">
              <a href={site.github} target="_blank" rel="noopener noreferrer">
                GitHub
              </a>
            </li>
            <li className="show-sm">
              <a href="/support" aria-current={path === "/support" ? "page" : undefined}>
                Support
              </a>
            </li>
            <li>
              {/* Ghost so the hero keeps the only filled CTA in the first viewport. */}
              <a className="btn btn-ghost" href="/#install">
                Install
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </motion.header>
  );
}
