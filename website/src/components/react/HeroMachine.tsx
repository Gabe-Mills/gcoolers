import { motion } from "framer-motion";
import { site } from "../../data/site";
import { minMacOS } from "../../data/product";
import MachineCore from "./MachineCore";
import ProductTerminal from "./ProductTerminal";
import MenuBarPreview from "./MenuBarPreview";
import WidgetPreview from "./WidgetPreview";

const ease = [0.19, 1, 0.22, 1] as const;

interface Props {
  ready: boolean;
}

/**
 * Hero.
 *
 * The wordmark and the core stay — that identity is the whole point. What
 * changes is that the software now shares the frame: the live view rises out of
 * the machine, the menu bar item floats above it, and the widget sits back in
 * the fog. They are staged on connecting rails at three different depths so the
 * composition reads as one instrument, not three screenshots in cards.
 */
export default function HeroMachine({ ready }: Props) {
  const show = (delay: number) => ({
    initial: { opacity: 0, y: 14, filter: "blur(12px)" },
    animate: ready ? { opacity: 1, y: 0, filter: "blur(0px)" } : { opacity: 0, y: 14, filter: "blur(12px)" },
    transition: { duration: 1.4, ease, delay: ready ? delay : 0 },
  });

  return (
    <section className="hero" id="top">
      <MachineCore className="hero-core" readout={false} fill={0.62} rpm={2450} />

      <div className="wrap hero-inner">
        <span className={`hero-glow${ready ? " is-revealed" : ""}`} aria-hidden="true" />

        <motion.p className="hero-tag" {...show(0.3)}>
          {site.tagline}
        </motion.p>

        <h1 className={`hero-title${ready ? " is-revealed" : ""}`}>{site.name}</h1>

        <motion.p className="hero-benefit" {...show(0.85)}>
          Cool under load. Quiet when idle.
        </motion.p>

        <motion.div className="btn-row hero-ctas" {...show(1.0)}>
          <a className="btn btn-primary" href="#install">
            Install with Homebrew
          </a>
          <a className="btn btn-ghost" href="#live">
            See it running
          </a>
        </motion.div>

        <motion.p className="hero-cmd mono" {...show(1.08)}>
          <span className="hero-cmd-prompt" aria-hidden="true">
            $
          </span>
          <code>{site.homebrew[0]}</code>
        </motion.p>

        <motion.p className="hero-meta" {...show(1.14)}>
          <span>Apple Silicon</span>
          <span>macOS {minMacOS}+</span>
          <span>Free · MIT</span>
          <span>
            <a href={site.github} target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
          </span>
        </motion.p>
      </div>

      {/* Product stage. Rails connect the three surfaces so they read as parts
          of one machine; the fog layer crosses in front of the widget to put it
          furthest back. */}
      <motion.div
        className="hero-stage"
        initial={{ opacity: 0, y: 44, filter: "blur(18px)" }}
        animate={ready ? { opacity: 1, y: 0, filter: "blur(0px)" } : { opacity: 0, y: 44, filter: "blur(18px)" }}
        transition={{ duration: 1.8, ease, delay: ready ? 1.3 : 0 }}
      >
        <span className="hero-rails" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>

        <div className="hero-stage-bar" aria-hidden="true">
          <MenuBarPreview />
        </div>

        <div className="hero-stage-term">
          <ProductTerminal variant="compact" />
        </div>

        <div className="hero-stage-widget" aria-hidden="true">
          <WidgetPreview family="small" />
        </div>

        <span className="hero-stage-fog" aria-hidden="true" />
      </motion.div>

      <motion.div
        className="hero-cue"
        initial={{ opacity: 0 }}
        animate={{ opacity: ready ? 1 : 0 }}
        transition={{ duration: 1.4, ease, delay: ready ? 2 : 0 }}
        aria-hidden="true"
      >
        <span className="hero-cue-label">Scroll to wake the fans</span>
        <span className="hero-cue-rail">
          <span />
        </span>
      </motion.div>
    </section>
  );
}
