/**
 * Verified product facts.
 *
 * Every string here was read out of the Gcoolers repository — `bin/gcoolers`,
 * `Sources/GcoolersBar.swift`, `Sources/GcoolersWidget.swift`,
 * `Tools/heatwatch-fan.c`, `scripts/install.sh`, and `Formula/gcoolers.rb`.
 * Nothing is estimated, benchmarked, or marketing-rounded. If a number appears
 * on the site, it appears in the source; the comment says where.
 */

/** `VERSION` in bin/gcoolers. This is what the menu bar and doctor print. */
export const version = "3.06";

/** LSMinimumSystemVersion, written into Gcoolers.app and GcoolersWidget.appex. */
export const minMacOS = "14";

/* ------------------------------------------------------------------ *
 * Profiles — PROFILES in bin/gcoolers
 * ------------------------------------------------------------------ */

export interface ProfileFacts {
  /** Fan curve starts here (auto_below, °F weighted peak). */
  startsAt: number;
  /** Fan reaches 100% here (max_at, °F). */
  fullAt: number;
  /** base_pct — the floor the curve is built on. */
  baseFan: number;
  /** check — seconds between governor samples. */
  sample: number;
  /** ramp — largest fan step allowed per sample. */
  step: number;
  /** cpu_w / gpu_w — how the weighted peak is composed. */
  weights: { cpu: number; gpu: number };
  /** hyst — °F of hysteresis before dropping back to AUTO. */
  hysteresis: number;
}

/** thermal_band() in bin/gcoolers, in °F. */
export const bands = [
  { label: "COOL", from: 0 },
  { label: "WARM", from: 130 },
  { label: "HOT", from: 145 },
  { label: "CRITICAL", from: 160 },
] as const;

/* ------------------------------------------------------------------ *
 * Meeting mode — MEETING_PROCESS_HINTS + config defaults
 * ------------------------------------------------------------------ */

export const meeting = {
  /** meeting_cap default in load_config(). */
  fanCeiling: 0.42,
  /** auto_meeting defaults to true. */
  autoDefault: true,
  /**
   * MEETING_PROCESS_HINTS, in source order. `mode` is the detection rule:
   * "any" fires on presence, "busy"/"discord" require CPU activity so a
   * backgrounded app does not count as a call.
   */
  apps: [
    { name: "Zoom", mode: "presence" },
    { name: "FaceTime", mode: "presence" },
    { name: "Webex", mode: "presence" },
    { name: "Discord", mode: "active" },
    { name: "Teams", mode: "active" },
    { name: "Slack", mode: "active" },
    { name: "Google Meet", mode: "learned" },
  ],
} as const;

/* ------------------------------------------------------------------ *
 * Schedule + quiet hours — schedule_active_profile() / in_quiet_hours()
 * ------------------------------------------------------------------ */

export const schedule = {
  /** schedule_enabled defaults to false — opt in with `gcoolers schedule on`. */
  defaultOn: false,
  dayStart: "09:00",
  dayEnd: "22:00",
  dayProfile: "cool",
  nightProfile: "quiet",
  /** in_quiet_hours(): 22:00–07:00 local, independent of the schedule. */
  quietHours: { from: "22:00", to: "07:00", defaultOn: true },
  /** profile_params() offsets applied during quiet hours. */
  quietHoursShift: {
    startsAt: 8,
    fullAt: 4,
    baseFan: -0.08,
    minSample: 25,
  },
} as const;

/* ------------------------------------------------------------------ *
 * Adaptive bias — update_learn_smart() / workload_key()
 * ------------------------------------------------------------------ */

export const adaptive = {
  /** workload_key() buckets. Bias is stored per bucket, not globally. */
  buckets: ["cpu", "gpu", "mixed", "battery", "lid"],
  /** Clamps in update_learn_smart(). */
  range: { min: -0.12, max: 0.18 },
  step: 0.012,
  /** Reward threshold: peak has to fall this much for bias to increase. */
  rewardDeltaF: 2,
} as const;

/* ------------------------------------------------------------------ *
 * Alerts — thermal_notify_tick() + config defaults
 * ------------------------------------------------------------------ */

export const alerts = {
  /** notify defaults to true. */
  defaultOn: true,
  /** Titles and bodies are the literal strings passed to _notify_emit(). */
  kinds: [
    {
      title: "Fans at MAX",
      body: "sustained MAX",
      gate: "after 60s in the MAX zone",
    },
    {
      title: "Still hot",
      body: "10+ min",
      gate: "after 10 minutes over the curve top",
    },
    {
      title: "Cooled down",
      body: "back to AUTO",
      gate: "2 minutes after returning to AUTO",
    },
  ],
  maxPerHour: 3,
  cooldownMinutes: 15,
} as const;

/* ------------------------------------------------------------------ *
 * History + export — history_append() / run_export()
 * ------------------------------------------------------------------ */

export const history = {
  /** Ring buffer cutoff in history_append(). */
  windowMinutes: 60,
  maxSamples: 360,
  minGapSeconds: 12,
  /** Only MAX transitions are recorded as events. */
  eventZone: "MAX",
  maxEvents: 40,
  /** run_export() writes into ~/Downloads. */
  outputs: ["CSV", "HTML"],
  /** Header row emitted by the CSV writer. */
  csvColumns: ["t", "iso", "peak_f", "cpu_f", "gpu_f", "pct", "zone", "load", "why"],
} as const;

/* ------------------------------------------------------------------ *
 * Zones — cool_until() writes these into state.json
 * ------------------------------------------------------------------ */

export const zones = ["AUTO", "SOFT", "MAX", "PAUSE", "BOOST"] as const;

/* ------------------------------------------------------------------ *
 * Menu bar — Sources/GcoolersBar.swift rebuildMenu()
 * ------------------------------------------------------------------ */

export const menuBar = {
  /** button.title formats in refresh(). */
  titles: [
    { state: "Governing", value: "118°" },
    { state: "Meeting mode", value: "🔇 118°" },
    { state: "Boost", value: "⚡ 118°" },
    { state: "Paused", value: "pause" },
  ],
  /** Menu rows, in source order. Grouped the way the separators group them. */
  groups: [
    { label: "Readout", items: ["Peak · zone", "CPU / GPU", "Why the fans are running", "Profile"] },
    { label: "History", items: ["Hour history…", "Add Widget…", "Export hour…"] },
    { label: "Modes", items: ["Meeting mode", "Meeting · Auto-detect", "Schedule"] },
    { label: "Override", items: ["Pause cooling", "Boost fans 60s"] },
    { label: "Force", items: ["Force AUTO", "Force MAX", "Clear force"] },
    { label: "Profiles", items: ["Quiet", "Balanced", "Cool"] },
    { label: "Alerts", items: ["Notifications"] },
  ],
} as const;

/** supportedFamilies in GcoolersTempWidget. */
export const widget = {
  families: ["Small", "Medium"],
  /** Rows the medium widget actually renders. */
  fields: ["peak °F", "zone · profile", "CPU", "GPU", "why"],
  /** Timeline policy in Provider.getTimeline(). */
  refreshSeconds: 30,
  /** configurationDisplayName / description. */
  name: "Gcoolers",
  description: "Live Apple Silicon temps, zone, and why the fans are running.",
} as const;

/* ------------------------------------------------------------------ *
 * Doctor — run_doctor() checks, in source order
 * ------------------------------------------------------------------ */

export const doctorChecks = [
  { name: "macmon", detail: "bundled sensor reader" },
  { name: "heatwatch-fan", detail: "fan helper binary" },
  { name: "fan helper root-owned", detail: "/Library/Application Support/Gcoolers/bin" },
  { name: "sudoers path", detail: "points at the root-owned helper, not a stale one" },
  { name: "passwordless fan sudo", detail: "/etc/sudoers.d/gcoolers" },
  { name: "LaunchAgent plist", detail: "~/Library/LaunchAgents" },
  { name: "LaunchAgent loaded", detail: "com.gcoolers.daemon" },
  { name: "daemon binary reachable by launchd", detail: "ProgramArguments path resolves" },
  { name: "daemon heartbeat", detail: "state.json age, zone, peak" },
  { name: "SMC sensors", detail: "cpu/gpu via macmon" },
  { name: "Gcoolers.app", detail: "~/Applications" },
  { name: "notifications", detail: "on/off · hot_minutes" },
] as const;

/* ------------------------------------------------------------------ *
 * Install — install_gcool()
 * ------------------------------------------------------------------ */

export const installChanges = [
  {
    path: "/Library/Application Support/Gcoolers/bin/heatwatch-fan",
    title: "Root-owned fan helper",
    body: "Copied out of your home so the NOPASSWD rule never points at a user-writable path.",
  },
  {
    path: "/etc/sudoers.d/gcoolers",
    title: "One sudoers rule",
    body: "NOPASSWD for that helper only. Validated with visudo. Password once.",
  },
  {
    path: "~/Library/LaunchAgents/com.gcoolers.daemon.plist",
    title: "User LaunchAgent",
    body: "Starts the governor at login. Logs to ~/Library/Logs/gcoolers.log.",
  },
  {
    path: "~/Applications/Gcoolers.app",
    title: "Menu bar app",
    body: "Built locally with swiftc. Widget included.",
  },
  {
    path: "~/Library/Application Support/Gcoolers",
    title: "Local state",
    body: "config, state, history, learn — never leave the Mac.",
  },
] as const;

/* ------------------------------------------------------------------ *
 * Commands — main() dispatch in bin/gcoolers
 * ------------------------------------------------------------------ */

export const commands = [
  { cmd: "gcoolers", what: "Live view. Daemon keeps running." },
  { cmd: "gcoolers doctor", what: "Health checks." },
  { cmd: "gcoolers install", what: "Helper, sudoers, agent, app." },
  { cmd: "gcoolers meeting on|off|auto", what: "Quiet fans for calls." },
  { cmd: "gcoolers schedule on|off|status", what: "Day / night profiles." },
  { cmd: "gcoolers export", what: "Hour → CSV + HTML." },
  { cmd: "gcoolers notify on|off", what: "Thermal alerts." },
  { cmd: "gcoolers widget", what: "Add Notification Center widget." },
  { cmd: "gcoolers status", what: "State as JSON." },
  { cmd: "gcoolers version", what: `v${version}` },
] as const;

/** Keys handled by attach_viewer(). */
export const liveKeys = [
  { key: "B", what: "Boost 60s" },
  { key: "P", what: "Pause / resume" },
  { key: "R", what: "Cycle profile" },
  { key: "Q", what: "Detach" },
  { key: "?", what: "Help" },
] as const;

/* ------------------------------------------------------------------ *
 * Compatibility — Formula/gcoolers.rb + build requirements
 * ------------------------------------------------------------------ */

export const compatibility = [
  {
    label: "Apple Silicon",
    value: "Required",
    note: "arm64 only. No Intel.",
  },
  {
    label: `macOS ${minMacOS}`,
    value: "Or newer",
    note: "App and widget minimum.",
  },
  {
    label: "Fans",
    value: "If your Mac has them",
    note: "Fanless Macs: sensors and history still work.",
  },
  {
    label: "Python 3.10+",
    value: "Homebrew handles it",
    note: "Pulled in by the formula.",
  },
  {
    label: "Xcode Command Line Tools",
    value: "For the app",
    note: "Needed to build the menu bar app. CLI works without it.",
  },
  {
    label: "Bundled helpers",
    value: "macmon · heatwatch-fan",
    note: "Sensors + SMC fan control.",
  },
] as const;

/* ------------------------------------------------------------------ *
 * Trust — sudoers_body(), launch_agent_plist(), heatwatch-fan.c, LICENSE
 * ------------------------------------------------------------------ */

export const trust = [
  {
    key: "01",
    label: "Local",
    line: "No account. No telemetry. No network.",
    body: "All state stays in ~/Library/Application Support/Gcoolers.",
  },
  {
    key: "02",
    label: "No kext",
    line: "User space only.",
    body: "Fan writes go through a small IOKit helper — nothing in the kernel.",
  },
  {
    key: "03",
    label: "Narrow privilege",
    line: "Passwordless sudo for the fan helper only.",
    body: "One binary, mode 440, checked with visudo.",
  },
  {
    key: "04",
    label: "Built locally",
    line: "swiftc on your Mac.",
    body: "Menu bar app and widget compile from Sources/ at install.",
  },
  {
    key: "05",
    label: "MIT",
    line: "Read it. Fork it. Audit it.",
    body: "One public repository for the whole stack.",
  },
] as const;

/* ------------------------------------------------------------------ *
 * FAQ — answers checked against the source, no legal promises
 * ------------------------------------------------------------------ */

export const faq = [
  {
    q: "How do I install it?",
    a: "brew install gabe-mills/gcoolers/gcoolers, then run gcool once. First run asks for your password for the fan helper.",
  },
  {
    q: "Is it free?",
    a: "Yes. MIT licensed, no account, no paid tier. Donations on the support page are optional.",
  },
  {
    q: "What does install change?",
    a: "Root-owned fan helper, one sudoers rule, a LaunchAgent, Gcoolers.app, and a local state folder. Details under Install.",
  },
  {
    q: "Kernel extension?",
    a: "No. User-space IOKit helper only. Fans return to macOS when Gcoolers stops.",
  },
  {
    q: "Which Macs?",
    a: `Apple Silicon, macOS ${minMacOS}+. Fanless Macs get sensors and history, not fan control.`,
  },
  {
    q: "Does it run locally?",
    a: "Yes. No network calls from the governor. State stays on your Mac.",
  },
  {
    q: "Meeting Mode?",
    a: `Detects call apps and holds fans at ${Math.round(meeting.fanCeiling * 100)}%. Or force it with gcoolers meeting on.`,
  },
  {
    q: "How do I remove it?",
    a: "Unload the LaunchAgent, brew uninstall gcoolers, remove /etc/sudoers.d/gcoolers and both Gcoolers Application Support folders, then delete ~/Applications/Gcoolers.app.",
  },
] as const;
