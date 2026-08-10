import { useEffect, useState } from "react";
import { usePageVisible } from "../../lib/hooks";

interface Layer {
  top: string;
  left: string;
  size: string;
  hue: number;
  chroma: number;
  /** Lightness of the mist body. Far layers sit darker so they read as distance. */
  lightness: number;
  alpha: number;
  blur: number;
  /** Depth desaturation, 0–1. Far mist loses its hue, near mist keeps it. */
  sat: number;
  dur: number;
  delay: number;
}

/**
 * Frost mist up top, exhaust haze down low, ordered back-to-front.
 *
 * Depth reads through three stacked cues rather than raw brightness: far layers
 * are darker, more blurred, and desaturated; near layers are tighter and hold
 * their hue. Keeping chroma low here is what stops five screen-blended circles
 * compositing into neon soup.
 *
 * The cost discipline matters on this particular site. Blurred, screen-blended
 * surfaces are the most expensive thing on the page, so: the set is trimmed to
 * five, every animation is transform and opacity only, the whole field stops
 * when the tab is hidden, and phones keep three layers with the grid and scan
 * sweep dropped entirely. A page about not overheating your Mac should not be
 * the reason a fan spins up.
 */
const LAYERS: Layer[] = [
  // Far — cold sky mass.
  { top: "-22%", left: "-14%", size: "68vw", hue: 238, chroma: 0.035, lightness: 0.46, alpha: 0.5, blur: 110, sat: 0.5, dur: 46, delay: 0 },
  { top: "2%", left: "56%", size: "54vw", hue: 214, chroma: 0.045, lightness: 0.52, alpha: 0.4, blur: 96, sat: 0.6, dur: 39, delay: -8 },
  // Mid — the working band behind the type.
  { top: "40%", left: "-10%", size: "46vw", hue: 172, chroma: 0.07, lightness: 0.62, alpha: 0.26, blur: 84, sat: 0.8, dur: 42, delay: -16 },
  // Near — exhaust pooling on the floor.
  { top: "76%", left: "20%", size: "60vw", hue: 58, chroma: 0.09, lightness: 0.66, alpha: 0.17, blur: 100, sat: 0.9, dur: 56, delay: -5 },
  { top: "28%", left: "30%", size: "30vw", hue: 218, chroma: 0.06, lightness: 0.68, alpha: 0.2, blur: 60, sat: 1, dur: 33, delay: -21 },
];

/** Phones keep the far pair plus one mid layer; the rest is invisible at that width. */
const MOBILE_LAYERS = [0, 1, 2];

export default function FrostMachineBackground() {
  const [lite, setLite] = useState(false);
  const visible = usePageVisible();

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 760px), (prefers-reduced-motion: reduce)");
    const apply = () => setLite(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const layers = lite ? MOBILE_LAYERS.map((i) => LAYERS[i]) : LAYERS;

  return (
    <div className={`frost${visible ? "" : " is-idle"}`} aria-hidden="true">
      {!lite && <div className="frost-grid" />}
      <div className="frost-horizon" />

      {layers.map((l, i) => (
        <div
          key={i}
          className="frost-layer"
          style={
            {
              top: l.top,
              left: l.left,
              width: l.size,
              height: l.size,
              background: `radial-gradient(circle, oklch(${l.lightness} ${l.chroma} ${l.hue} / ${l.alpha}), transparent 70%)`,
              filter: `blur(${lite ? Math.round(l.blur * 0.6) : l.blur}px) saturate(${l.sat})`,
              "--dur": `${l.dur}s`,
              "--delay": `${l.delay}s`,
            } as React.CSSProperties
          }
        />
      ))}

      {!lite && <div className="frost-scan" />}
      <div className="frost-grain" />
      <div className="frost-vignette" />
    </div>
  );
}
