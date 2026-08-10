import { useEffect, useState } from "react";
import { site } from "../../data/site";

/**
 * Sticky install bar — phones only.
 *
 * Three rules kept this from turning into an ecommerce sales bar:
 *
 * 1. It does not appear over the hero. The hero already has the primary CTA
 *    directly under the headline, so covering it would be arguing with itself.
 *    The bar waits until the hero has scrolled past.
 * 2. It shows the command, not a slogan. `brew install …` is the actual thing
 *    a person needs, and tapping copies it rather than bouncing them somewhere.
 * 3. It is dismissible, and it stays dismissed for the rest of the session.
 *
 * It also hides itself once the install chapter is on screen — at that point
 * the real install panel is right there and the bar is redundant.
 */
const DISMISS_KEY = "gcoolers:install-bar-dismissed";
const CMD = site.homebrew[0];

export default function StickyInstall() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  useEffect(() => {
    if (dismissed) return;

    const hero = document.getElementById("top");
    const install = document.getElementById("install");
    if (!hero) return;

    // Two independent observers: past the hero turns it on, reaching the
    // install chapter turns it back off.
    let pastHero = false;
    let atInstall = false;
    const sync = () => setVisible(pastHero && !atInstall);

    const heroObs = new IntersectionObserver(
      ([e]) => {
        pastHero = !e.isIntersecting && e.boundingClientRect.top < 0;
        sync();
      },
      { threshold: 0 },
    );
    heroObs.observe(hero);

    let installObs: IntersectionObserver | undefined;
    if (install) {
      installObs = new IntersectionObserver(
        ([e]) => {
          atInstall = e.isIntersecting;
          sync();
        },
        { threshold: 0 },
      );
      installObs.observe(install);
    }

    return () => {
      heroObs.disconnect();
      installObs?.disconnect();
    };
  }, [dismissed]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(CMD);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard can be refused; the command is visible either way, and the
      // install chapter is one tap along the bar.
    }
  }

  function dismiss() {
    setDismissed(true);
    setVisible(false);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* session storage can be unavailable; dismissal just won't persist */
    }
  }

  if (dismissed) return null;

  return (
    <div className={`sticky-install${visible ? " is-shown" : ""}`} aria-hidden={!visible}>
      <button
        type="button"
        className="sticky-install-cmd"
        onClick={copy}
        tabIndex={visible ? 0 : -1}
        aria-label={`Copy install command: ${CMD}`}
      >
        <span className="sticky-install-prompt" aria-hidden="true">
          $
        </span>
        <code>{CMD}</code>
        <span className="sticky-install-copy mono" aria-hidden="true">
          {copied ? "copied" : "copy"}
        </span>
      </button>

      <a className="sticky-install-go" href="/#install" tabIndex={visible ? 0 : -1}>
        Install
      </a>

      <button
        type="button"
        className="sticky-install-x"
        onClick={dismiss}
        tabIndex={visible ? 0 : -1}
        aria-label="Dismiss the install bar"
      >
        <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
          <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.5" fill="none" />
        </svg>
      </button>

      <p className="sr-only" role="status" aria-live="polite">
        {copied ? "Install command copied to the clipboard" : ""}
      </p>
    </div>
  );
}
