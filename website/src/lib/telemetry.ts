import { profiles, type Profile } from "../data/profiles";

/**
 * A port of the governor's own arithmetic.
 *
 * The demonstrations on this page are driven by the same functions the daemon
 * uses, so the fan percentage shown next to a temperature is the percentage
 * Gcoolers would actually ask for at that temperature. The only invented input
 * is the synthetic load walk — the machine is not really under load in a
 * browser tab, and the site says so where it matters.
 */

export const clamp = (v: number, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** curve_fan_pct() in bin/gcoolers. */
export function curveFanPct(peak: number, lo: number, hi: number, basePct: number) {
  if (hi <= lo) return 1;
  const t = clamp((peak - lo) / (hi - lo));
  return basePct + (1 - basePct) * t ** 1.2;
}

/** weighted_peak() in bin/gcoolers. */
export function weightedPeak(cpuF: number, gpuF: number, cpuW: number, gpuW: number) {
  return Math.max(cpuF * cpuW + gpuF * gpuW, Math.max(cpuF, gpuF) * 0.92);
}

export type Band = "COOL" | "WARM" | "HOT" | "CRITICAL";

/** thermal_band() in bin/gcoolers, in °F. */
export function thermalBand(f: number): { label: Band; glyph: string; tone: string } {
  if (f >= 160) return { label: "CRITICAL", glyph: "▲", tone: "crit" };
  if (f >= 145) return { label: "HOT", glyph: "▲", tone: "hot" };
  if (f >= 130) return { label: "WARM", glyph: "◆", tone: "warm" };
  // ◇ over ❄ — matches thermal_band() in bin/gcoolers (snowflake is double-width).
  return { label: "COOL", glyph: "◇", tone: "cool" };
}

/** The wave ramp used by sparkline() in bin/gcoolers. */
const WAVE = " ▁▂▃▄▅▆▇█";

export function waveChar(t: number) {
  return WAVE[Math.round(clamp(t) * (WAVE.length - 1))];
}

/** sparkline()'s colour thresholds, as class suffixes. */
export function waveTone(t: number) {
  return t > 0.85 ? "crit" : t > 0.55 ? "hot" : "cool";
}

/** meter() / temp_meter() — a block bar of `width` cells. */
export function meterCells(ratio: number, width = 14) {
  const n = Math.round(clamp(ratio) * width);
  return { filled: n, empty: width - n };
}

/** temp_norm() in bin/gcoolers — 95–172°F onto the bar. */
export function tempRatio(f: number, lo = 95, hi = 172) {
  return clamp((f - lo) / (hi - lo));
}

export function profileById(id: Profile["id"]) {
  return profiles.find((p) => p.id === id) ?? profiles[1];
}

/* ------------------------------------------------------------------ *
 * Synthetic load walk
 * ------------------------------------------------------------------ */

export interface Telemetry {
  cpuF: number;
  gpuF: number;
  peakF: number;
  avgF: number;
  fanPct: number;
  /** Zone string, formatted the way cool_until() writes it into state.json. */
  zone: string;
  band: ReturnType<typeof thermalBand>;
  /** Seconds until the next governor sample. */
  nextSample: number;
  history: number[];
  gpuHistory: number[];
}

/**
 * A smooth pseudo-random walk in load, converted into temperatures and then
 * into a fan percentage through the real curve. Deterministic per phase so the
 * shape reads as a machine warming and settling rather than noise.
 */
export function sampleTelemetry(profile: Profile, phase: number): Omit<Telemetry, "history" | "gpuHistory"> {
  const { startsAt, fullAt, baseFan, sample } = profile.readouts;
  const { cpu: cpuW, gpu: gpuW } = profile.facts.weights;

  // Two slow sines and one faster one: a long thermal soak with working noise.
  const soak = 0.5 + 0.5 * Math.sin(phase * 0.21);
  const burst = 0.5 + 0.5 * Math.sin(phase * 0.73 + 1.1);
  const jitter = Math.sin(phase * 2.3) * 0.5 + Math.sin(phase * 3.7) * 0.3;

  const load = clamp(soak * 0.68 + burst * 0.3);
  const cpuF = 104 + load * 44 + jitter * 1.6;
  const gpuF = 100 + load * 40 + Math.sin(phase * 0.55 + 2.2) * 3.5;
  const peakF = weightedPeak(cpuF, gpuF, cpuW, gpuW);
  const avgF = peakF - 2.4 - soak * 1.6;

  const engaged = peakF >= startsAt;
  const fanPct = engaged ? curveFanPct(peakF, startsAt, fullAt, baseFan) : 0;
  const band = thermalBand(peakF);

  let zone: string;
  if (!engaged) zone = "AUTO";
  else if (fanPct >= 0.97) zone = "MAX";
  else zone = `${Math.round(fanPct * 100)}%`;

  return {
    cpuF,
    gpuF,
    peakF,
    avgF,
    fanPct,
    zone,
    band,
    nextSample: Math.max(1, Math.round(sample - (phase % sample))),
  };
}
