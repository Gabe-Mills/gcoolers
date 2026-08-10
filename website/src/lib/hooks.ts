import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { sampleTelemetry, type Telemetry } from "./telemetry";
import type { Profile } from "../data/profiles";

/**
 * useLayoutEffect on the client, useEffect during the Astro server render.
 *
 * For GSAP setup: the opening `gsap.set()` that poses the not-yet-arrived
 * modules has to land before the browser paints, or the sequence flashes fully
 * assembled for a frame and then collapses into its start state.
 */
export const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** True once the element has entered the viewport, and stays true. */
export function useInView<T extends Element>(rootMargin = "-12% 0px") {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (!("IntersectionObserver" in window)) {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin, seen]);

  return [ref, seen] as const;
}

/** Live while the element is on screen; unsubscribes the moment it leaves. */
export function useOnScreen<T extends Element>(rootMargin = "20% 0px") {
  const ref = useRef<T | null>(null);
  const [onScreen, setOnScreen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      setOnScreen(true);
      return;
    }
    const io = new IntersectionObserver((entries) => setOnScreen(entries[0]?.isIntersecting ?? false), {
      rootMargin,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);

  return [ref, onScreen] as const;
}

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return reduced;
}

/** True while the tab is actually being looked at. */
export function usePageVisible() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const apply = () => setVisible(document.visibilityState === "visible");
    apply();
    document.addEventListener("visibilitychange", apply);
    return () => document.removeEventListener("visibilitychange", apply);
  }, []);
  return visible;
}

const HISTORY_LEN = 34;

/**
 * Drives the product mockups.
 *
 * Ticks at ~4Hz, which is close to the real viewer's 0.35s redraw — fast enough
 * to read as live, slow enough that a page full of these costs nothing. The loop
 * is torn down whenever the tab is hidden or the mockup is off screen, so a
 * thermal-control site does not sit there heating the machine.
 */
export function useTelemetry(profile: Profile, active: boolean, frozen = false): Telemetry {
  const [state, setState] = useState<Telemetry>(() => {
    const s = sampleTelemetry(profile, 0);
    return { ...s, history: Array(HISTORY_LEN).fill(s.peakF), gpuHistory: Array(HISTORY_LEN).fill(s.gpuF) };
  });

  const phase = useRef(0);
  const history = useRef<number[]>([]);
  const gpuHistory = useRef<number[]>([]);

  // Seed the sparklines with a plausible past so the first paint is not flat.
  useEffect(() => {
    if (history.current.length) return;
    for (let i = 0; i < HISTORY_LEN; i++) {
      const s = sampleTelemetry(profile, (i - HISTORY_LEN) * 0.42);
      history.current.push(s.peakF);
      gpuHistory.current.push(s.gpuF);
    }
  }, [profile]);

  useEffect(() => {
    if (!active || frozen) return;
    let raf = 0;
    let last = 0;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < 240) return;
      last = now;
      phase.current += 0.42;
      const s = sampleTelemetry(profile, phase.current);
      history.current = [...history.current.slice(-(HISTORY_LEN - 1)), s.peakF];
      gpuHistory.current = [...gpuHistory.current.slice(-(HISTORY_LEN - 1)), s.gpuF];
      setState({ ...s, history: history.current, gpuHistory: gpuHistory.current });
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, frozen, profile]);

  return state;
}
