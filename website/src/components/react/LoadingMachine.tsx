import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { boot } from "../../data/scenes";

interface Props {
  active: boolean;
  /** Same-session return: a short resume instead of the full arming sequence. */
  resume: boolean;
  onDone: () => void;
}

const ease = [0.19, 1, 0.22, 1] as const;

/** Graduations on the boot rail. Every fifth one is a major tick. */
const GRADS = 21;

/**
 * The arming sequence.
 *
 * Steps, values, and the FROST LOCK beat are lifted from gcool_splash() in
 * bin/gcoolers, so what the browser shows is what the terminal shows on a cold
 * start. Two things are deliberately restrained: the whole sequence is 2.5s on
 * a first visit and 0.7s on a same-session return, and the accessible status
 * announces the current *step* rather than every percentage frame.
 */
export default function LoadingMachine({ active, resume, onDone }: Props) {
  const [progress, setProgress] = useState(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const duration = resume ? boot.resumeDuration : boot.duration;

  useEffect(() => {
    if (!active) return;
    // The origin comes from the first frame, not from performance.now(): a
    // rAF timestamp is the time the frame *began*, which can predate the moment
    // this effect ran, and a negative elapsed time indexes past the start of the
    // step list.
    let start = 0;
    let frame = 0;

    const tick = (now: number) => {
      if (!start) start = now;
      const p = Math.min((now - start) / duration, 1);
      setProgress(p);
      if (p < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        doneRef.current();
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, duration]);

  const step = Math.min(Math.floor(progress * boot.steps.length), boot.steps.length - 1);
  const locked = progress > 0.94;

  // Only the step label reaches the live region, so a screen reader hears five
  // updates instead of a hundred percentage ticks.
  const announcement = useMemo(
    () => (locked ? `${boot.lock}. ${boot.online}.` : boot.steps[step].label),
    [locked, step],
  );

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className={`boot${resume ? " is-resume" : ""}`}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, filter: "blur(22px)", scale: 1.03 }}
          transition={{ duration: resume ? 0.5 : 0.9, ease }}
        >
          <p className="sr-only" role="status" aria-live="polite">
            {announcement}
          </p>

          <motion.div
            className="boot-inner"
            initial={{ opacity: 0, filter: "blur(14px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            transition={{ duration: resume ? 0.3 : 0.9, ease }}
            aria-hidden="true"
          >
            <div className="boot-head">
              <p className="boot-word">Gcoolers</p>
              <p className="boot-pct">{String(Math.round(progress * 100)).padStart(3, "0")}%</p>
            </div>

            <div className="boot-rail">
              <div className="boot-grads">
                {Array.from({ length: GRADS }, (_, i) => (
                  <i key={i} className={i / (GRADS - 1) <= progress ? "is-lit" : undefined} />
                ))}
              </div>
              <div className="boot-rail-fill" style={{ transform: `scaleX(${progress.toFixed(4)})` }} />
            </div>

            <ul className="boot-log">
              {boot.steps.map((line, i) => (
                <li
                  key={line.label}
                  className={i < step ? "is-done" : i === step ? "is-active" : undefined}
                >
                  <em>{String(i + 1).padStart(2, "0")}</em>
                  <span>{line.label}</span>
                  <b>{i < step || locked ? line.value : i === step ? "···" : ""}</b>
                </li>
              ))}
            </ul>

            <p className={`boot-lock${locked ? " is-on" : ""}`}>
              <i aria-hidden="true">❄</i>
              {boot.lock}
              <i aria-hidden="true">❄</i>
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
