import { profiles, type Profile } from "./profiles";

export interface Scene {
  profile: Profile;
  /** Scroll progress (0–1) at which this scene is fully resolved. */
  anchor: number;
}

/**
 * Scroll stage height. The original sequence ran 450svh, which read as an
 * endurance test — three headlines should not cost four and a half screens of
 * scrolling. 300svh gives each module ~100svh to arrive, hold, and leave, which
 * is enough for the cross-fade to land without the page feeling stuck.
 */
export const STAGE_VH = 300;

/** Timeline units consumed by the pinned sequence (in + out per module). */
export const TIMELINE_UNITS = profiles.length * 2 - 1;

export const scenes: Scene[] = profiles.map((profile, i) => ({
  profile,
  anchor: profiles.length > 1 ? i / (profiles.length - 1) : 0,
}));

/**
 * Boot register.
 *
 * These are the five arming steps from gcool_splash() in bin/gcoolers, in
 * source order, with the same wording the terminal prints. The final beat is
 * the FROST LOCK pulse the splash ends on before it hands off to the live view.
 */
export const boot = {
  steps: [
    { label: "detecting silicon", value: "Apple Silicon" },
    { label: "attaching sensor array", value: "14/14" },
    { label: "mapping thermal core", value: "complete" },
    { label: "arming governor", value: "complete" },
    { label: "locking profile", value: "BALANCED" },
  ],
  lock: "Frost lock",
  online: "Thermal core online",
  /** ms — full cinematic sequence on a first visit. */
  duration: 2500,
  /** ms — same-session resume. Long enough to feel deliberate, short enough to skip. */
  resumeDuration: 700,
  /** sessionStorage key guarding the full sequence. */
  storageKey: "gcoolers:booted",
} as const;
