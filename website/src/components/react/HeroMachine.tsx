import { motion } from "framer-motion";
import { site } from "../../data/site";
import { minMacOS } from "../../data/product";
import ProductTerminal from "./ProductTerminal";

const ease = [0.19, 1, 0.22, 1] as const;

interface Props {
  ready: boolean;
}

/**
 * Hero: brand, one line, install, and a live replica of the gcoolers TUI.
 */
export default function HeroMachine({ ready }: Props) {
  const show = (delay: number) => ({
    initial: { opacity: 0, y: 10, filter: "blur(8px)" },
    animate: ready ? { opacity: 1, y: 0, filter: "blur(0px)" } : { opacity: 0, y: 10, filter: "blur(8px)" },
    transition: { duration: 0.55, ease, delay: ready ? delay : 0 },
  });

  return (
    <section className="hero hero-simple" id="top">
      <div className="wrap hero-inner">
        <motion.p className="hero-tag" {...show(0.04)}>
          {site.tagline}
        </motion.p>

        <h1 className={`hero-title${ready ? " is-revealed" : ""}`}>{site.name}</h1>

        <motion.p className="hero-benefit" {...show(0.1)}>
          Cool under load. Quiet when idle.
        </motion.p>

        <motion.div className="btn-row hero-ctas" {...show(0.14)}>
          <a className="btn btn-primary" href="#install">
            Install with Homebrew
          </a>
          <a className="btn btn-ghost" href={site.github} target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
        </motion.div>

        <motion.p className="hero-cmd mono" {...show(0.18)}>
          <span className="hero-cmd-prompt" aria-hidden="true">
            $
          </span>
          <code>{site.homebrew[0]}</code>
        </motion.p>

        <motion.p className="hero-meta" {...show(0.2)}>
          <span>Apple Silicon</span>
          <span>macOS {minMacOS}+</span>
          <span>Free · MIT</span>
        </motion.p>
      </div>

      <motion.div
        className="hero-live"
        id="live"
        initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
        animate={ready ? { opacity: 1, y: 0, filter: "blur(0px)" } : { opacity: 0, y: 16, filter: "blur(8px)" }}
        transition={{ duration: 0.6, ease, delay: ready ? 0.22 : 0 }}
      >
        <ProductTerminal variant="full" className="hero-tui" />
      </motion.div>
    </section>
  );
}
