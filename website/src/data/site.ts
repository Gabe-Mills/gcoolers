import { minMacOS, version } from "./product";

export const site = {
  name: "Gcoolers",
  domain: "gcoolers.com",
  tagline: "Apple Silicon thermal governor",
  version,
  /**
   * Kept under ~160 characters so search results show the whole sentence
   * rather than cutting it mid-clause. The longer positioning line lives in
   * the hero, where there is room for it.
   */
  description:
    "A free, open-source thermal governor for Apple Silicon Macs. A local daemon, menu bar readout, and widget shape the fan curve around what your Mac is doing.",
  email: "support@gcoolers.com",
  github: "https://github.com/Gabe-Mills/gcoolers",
  issues: "https://github.com/Gabe-Mills/gcoolers/issues/new",
  /** Releases index rather than a pinned tag, so the link cannot rot. */
  releases: "https://github.com/Gabe-Mills/gcoolers/releases",
  license: "https://github.com/Gabe-Mills/gcoolers/blob/main/LICENSE",
  readme: "https://github.com/Gabe-Mills/gcoolers#readme",
  homebrewTap: "https://github.com/Gabe-Mills/homebrew-gcoolers",
  minMacOS,
  /**
   * The install flow from the README, verbatim.
   *
   * `brew install <tap>/<formula>` taps and installs in one command, and the
   * first run of `gcool` performs setup itself — first_run_needed() in
   * bin/gcoolers calls install_gcool(). This used to list four commands
   * (`brew tap`, `brew install gcoolers`, `gcoolers install`, `gcoolers
   * doctor`), which stopped matching the README at v3.06.
   */
  homebrew: ["brew install gabe-mills/gcoolers/gcoolers", "gcool"],
  /** The no-Homebrew path, also from the README. */
  curlInstall:
    "curl -fsSL https://cdn.jsdelivr.net/gh/Gabe-Mills/gcoolers@main/scripts/get.sh | bash",
  donate: {
    buyMeACoffee: "https://buymeacoffee.com/g_man9410",
    cashApp: "https://cash.app/$Gman9410",
  },
} as const;

/** Primary navigation. Anchors are section ids on the homepage. */
export const nav = [
  { label: "Features", href: "/#features" },
  { label: "How it works", href: "/#profiles" },
  { label: "Compatibility", href: "/#compatibility" },
] as const;
