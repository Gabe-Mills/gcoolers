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
    title: "A root-owned copy of the fan helper",
    body:
      "The binary that sudo is allowed to run is installed here, owned by root. " +
      "A passwordless sudo rule must never point at a path you can write to, " +
      "because anything that can replace the file inherits the privilege — so " +
      "the helper is copied out of your home directory before the rule names it.",
  },
  {
    path: "/etc/sudoers.d/gcoolers",
    title: "One sudoers rule",
    body:
      "A NOPASSWD entry for that root-owned path alone — nothing else gets elevated. " +
      "Gcoolers writes it with 440 permissions and validates it through visudo, " +
      "removing it again if visudo rejects it. This is the one time you type your password.",
  },
  {
    path: "~/Library/LaunchAgents/com.gcoolers.daemon.plist",
    title: "A user LaunchAgent",
    body:
      "Runs the governor at login and restarts it if it exits. A user agent, not a " +
      "system daemon, and it logs to ~/Library/Logs/gcoolers.log.",
  },
  {
    path: "~/Applications/Gcoolers.app",
    title: "The menu bar app",
    body:
      "Compiled locally with swiftc from Sources/, so nothing arrives pre-built. " +
      "The Notification Center widget ships inside it as GcoolersWidget.appex.",
  },
  {
    path: "~/Library/Application Support/Gcoolers",
    title: "Local state only",
    body:
      "config.json, state.json, history.json, and learn.json. Temperatures, the " +
      "active profile, and the adaptive bias live here and go nowhere else.",
  },
] as const;

/* ------------------------------------------------------------------ *
 * Commands — main() dispatch in bin/gcoolers
 * ------------------------------------------------------------------ */

export const commands = [
  { cmd: "gcoolers", what: "Frost-lock splash, then attach the live view. The daemon keeps running." },
  { cmd: "gcoolers doctor", what: "Nine health checks across sensors, helper, agent, and app." },
  { cmd: "gcoolers install", what: "Sudoers rule, LaunchAgent, menu bar app. Password once." },
  { cmd: "gcoolers meeting on|off|auto", what: "Hold the fan ceiling for calls, or let detection do it." },
  { cmd: "gcoolers schedule on|off|status", what: "Day profile between 09:00 and 22:00, night profile after." },
  { cmd: "gcoolers export", what: "Last hour to CSV and HTML in ~/Downloads." },
  { cmd: "gcoolers notify on|off", what: "Dwell-gated thermal alerts, at most three an hour." },
  { cmd: "gcoolers widget", what: "How to add the Notification Center widget." },
  { cmd: "gcoolers status", what: "Print the governor's current state as JSON." },
  { cmd: "gcoolers version", what: `Prints Gcoolers v${version}.` },
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
    note: "The Homebrew formula is arm64-only and the sensor reader is an arm64 build. Intel Macs are not supported.",
  },
  {
    label: `macOS ${minMacOS}`,
    value: "Or newer",
    note: "The menu bar app and the widget are both built against a macOS 14 minimum.",
  },
  {
    label: "Fans",
    value: "If your Mac has them",
    note: "On a fanless Mac — MacBook Air, iPad-class silicon — there is nothing to spin. Monitoring, alerts, history, and export still work; fan control has no hardware to act on.",
  },
  {
    label: "Python 3.10+",
    value: "Homebrew handles it",
    note: "The governor is Python. Installing through Homebrew pulls python@3.12 as a dependency.",
  },
  {
    label: "Xcode Command Line Tools",
    value: "For the app",
    note: "swiftc compiles the menu bar app and widget on your machine. Without it the daemon and CLI still run.",
  },
  {
    label: "Bundled helpers",
    value: "macmon · heatwatch-fan",
    note: "macmon reads the sensors. heatwatch-fan talks to the SMC and is compiled from Tools/heatwatch-fan.c during install.",
  },
] as const;

/* ------------------------------------------------------------------ *
 * Trust — sudoers_body(), launch_agent_plist(), heatwatch-fan.c, LICENSE
 * ------------------------------------------------------------------ */

export const trust = [
  {
    key: "01",
    label: "Local",
    line: "No account, no telemetry, no network call.",
    body: "Sensors are read on your Mac and written to ~/Library/Application Support/Gcoolers. There is no server to send them to.",
  },
  {
    key: "02",
    label: "No kernel extension",
    line: "User space, start to finish.",
    body: "Fan writes go through a small IOKit helper compiled from Tools/heatwatch-fan.c. Nothing is loaded into the kernel.",
  },
  {
    key: "03",
    label: "One narrow privilege",
    line: "Passwordless sudo for the fan helper only.",
    body: "The sudoers rule names that single binary. It is written 440, validated with visudo, and removed again if validation fails.",
  },
  {
    key: "04",
    label: "Built on your machine",
    line: "swiftc compiles the app locally.",
    body: "The menu bar app and widget are built from Sources/ during install rather than shipped as an opaque binary.",
  },
  {
    key: "05",
    label: "MIT licensed",
    line: "Read it, fork it, audit it.",
    body: "The governor, the helper, the menu bar app, and the widget are all in one public repository.",
  },
] as const;

/* ------------------------------------------------------------------ *
 * FAQ — answers checked against the source, no legal promises
 * ------------------------------------------------------------------ */

export const faq = [
  {
    q: "How do I install it?",
    a: "One Homebrew command — brew install gabe-mills/gcoolers/gcoolers — then run gcool once. The first run does the setup itself and asks for your password a single time, for the fan helper. If you would rather not use Homebrew there is a script in the README that clones the repo and runs the same installer.",
  },
  {
    q: "Is it free?",
    a: "Yes. Gcoolers is MIT licensed and the whole thing — governor, SMC helper, menu bar app, and widget — is in one public repository. There is no paid tier, no licence key, and no account. Donations exist on the support page and are entirely optional.",
  },
  {
    q: "What does Gcoolers actually change on my Mac?",
    a: `Five things, all listed above: a root-owned copy of the fan helper in /Library/Application Support/Gcoolers/bin, a sudoers rule scoped to exactly that path, a user LaunchAgent that keeps the governor running, a locally compiled Gcoolers.app in ~/Applications, and a state folder in ~/Library/Application Support. While it runs it sets fan targets through the SMC.`,
  },
  {
    q: "Does it modify macOS or firmware?",
    a: "No. There is no kernel extension, no system daemon, and no firmware write. Fan targets are set through the SMC interface the same way Apple's own fan management does, and they are handed back when the governor stops.",
  },
  {
    q: "Does it use a kernel extension?",
    a: "No. The only privileged component is heatwatch-fan, a small user-space binary compiled from Tools/heatwatch-fan.c that talks to IOKit.",
  },
  {
    q: "Which Macs are supported?",
    a: `Apple Silicon Macs on macOS ${minMacOS} or newer. The Homebrew formula requires arm64, and both the app and the widget are built against a macOS ${minMacOS} minimum.`,
  },
  {
    q: "What happens on a fanless Mac?",
    a: "Everything except fan control. Live CPU, GPU, and peak telemetry, profiles, meeting mode, schedules, alerts, history, and export all work. There are simply no fans for the governor to drive.",
  },
  {
    q: "Does it run locally?",
    a: "Yes. Nothing leaves the machine. There is no account, no analytics, and no network call in the governor — sensor samples are written to a local state folder and rotated out after an hour.",
  },
  {
    q: "How does Meeting Mode work?",
    a: `It watches for call apps by process activity — Zoom, FaceTime, and Webex count as soon as they are present; Discord, Teams, and Slack have to be doing work so a backgrounded app is not mistaken for a call. When one is detected the fan ceiling drops to ${Math.round(
      meeting.fanCeiling * 100,
    )}% and the previous behaviour returns afterwards. It does not promise silence, and it is not a guarantee that a call was correctly detected.`,
  },
  {
    q: "Does it start automatically?",
    a: "Yes, once you have run gcoolers install. The LaunchAgent starts the governor at login and restarts it if it exits.",
  },
  {
    q: "What happens if Gcoolers stops?",
    a: "The fans go back to macOS. Pausing releases them explicitly, and the helper restores automatic control rather than leaving a target pinned.",
  },
  {
    q: "How do I remove it?",
    a: "There is no uninstall subcommand yet — removal is manual: launchctl unload ~/Library/LaunchAgents/com.gcoolers.daemon.plist, brew uninstall gcoolers, sudo rm /etc/sudoers.d/gcoolers, sudo rm -rf '/Library/Application Support/Gcoolers', then delete ~/Applications/Gcoolers.app and ~/Library/Application Support/Gcoolers. The two Application Support paths are different: one is the root-owned helper, the other is your local state.",
  },
  {
    q: "What information should I include in a support email?",
    a: "Your Mac model, your macOS version, the Gcoolers version, the active profile, the full output of gcoolers doctor, and anything relevant from ~/Library/Logs/gcoolers.log.",
  },
] as const;
