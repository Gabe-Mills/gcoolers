import type { ProfileFacts } from "./product";

/**
 * Readouts the pinned sequence interpolates between.
 *
 * These are the governor's own constants, not a simulated benchmark. `startsAt`
 * and `fullAt` are `auto_below` and `max_at` from PROFILES in bin/gcoolers;
 * `baseFan` is `base_pct`; `sample` is `check`. The scroll timeline lerps
 * between the three columns, so what moves on screen is the shape of the real
 * fan curve — not an invented temperature drop.
 *
 * There is deliberately no dBA figure anywhere: nothing in Gcoolers measures
 * sound, so the site cannot report it.
 */
export interface Readouts {
  /** auto_below — weighted peak, °F, where the curve engages. */
  startsAt: number;
  /** max_at — weighted peak, °F, where the fan reaches 100%. */
  fullAt: number;
  /** base_pct — fan floor the curve is built on, 0–1. */
  baseFan: number;
  /** check — seconds between governor samples. */
  sample: number;
}

export interface Profile {
  id: "quiet" | "balanced" | "cool";
  index: string;
  name: string;
  /** The label the CLI and menu bar actually print for this profile. */
  displayLabel: string;
  /** One line. Motion carries the rest. */
  line: string;
  /** Mono caption under the readout rail. */
  signal: string;
  /** oklch components, lerped along the scroll timeline. */
  core: { l: number; c: number; h: number };
  readouts: Readouts;
  facts: ProfileFacts;
  rail: string[];
}

export const profiles: Profile[] = [
  {
    id: "quiet",
    index: "01",
    name: "Quiet",
    displayLabel: "SILENT",
    line: "The curve waits longer before it asks the fans for anything.",
    signal: "governor holding the lowest floor it has",
    core: { l: 0.82, c: 0.13, h: 158 },
    readouts: { startsAt: 125, fullAt: 148, baseFan: 0.35, sample: 25 },
    facts: {
      startsAt: 125,
      fullAt: 148,
      baseFan: 0.35,
      sample: 25,
      step: 0.12,
      weights: { cpu: 0.4, gpu: 0.6 },
      hysteresis: 7,
    },
    rail: ["latest ramp", "smallest steps", "gpu-weighted"],
  },
  {
    id: "balanced",
    index: "02",
    name: "Balanced",
    displayLabel: "BALANCED",
    line: "The default. Headroom without the roar.",
    signal: "governor tracking the weighted peak every 20s",
    core: { l: 0.84, c: 0.12, h: 208 },
    readouts: { startsAt: 118, fullAt: 142, baseFan: 0.42, sample: 20 },
    facts: {
      startsAt: 118,
      fullAt: 142,
      baseFan: 0.42,
      sample: 20,
      step: 0.15,
      weights: { cpu: 0.45, gpu: 0.55 },
      hysteresis: 6,
    },
    rail: ["adaptive bias", "even weighting", "menu bar live"],
  },
  {
    id: "cool",
    index: "03",
    name: "Cool",
    displayLabel: "FROST",
    line: "Everything moves earlier, so heat has less time to build.",
    signal: "governor sampling every 15s and stepping harder",
    core: { l: 0.8, c: 0.16, h: 62 },
    readouts: { startsAt: 112, fullAt: 136, baseFan: 0.5, sample: 15 },
    facts: {
      startsAt: 112,
      fullAt: 136,
      baseFan: 0.5,
      sample: 15,
      step: 0.18,
      weights: { cpu: 0.5, gpu: 0.5 },
      hysteresis: 5,
    },
    rail: ["earliest ramp", "largest steps", "tightest hysteresis"],
  },
];

/** What each column of the pinned readout rail is measuring. */
export const readoutMeta = [
  { key: "startsAt", label: "curve starts", unit: "°F" },
  { key: "fullAt", label: "fan full at", unit: "°F" },
  { key: "baseFan", label: "fan floor", unit: "%" },
  { key: "sample", label: "sample every", unit: "s" },
] as const;
