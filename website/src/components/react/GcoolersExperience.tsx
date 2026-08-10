import { useCallback, useEffect, useState } from "react";
import { MotionConfig } from "framer-motion";
import { boot } from "../../data/scenes";
import FrostMachineBackground from "./FrostMachineBackground";
import LoadingMachine from "./LoadingMachine";
import Navbar from "./Navbar";
import HeroMachine from "./HeroMachine";
import WhatItDoes from "./WhatItDoes";
import LiveView from "./LiveView";
import ScrollMachine from "./ScrollMachine";
import MeetingMode from "./MeetingMode";
import MenuBarSection from "./MenuBarSection";
import WidgetSection from "./WidgetSection";
import ScheduleTimeline from "./ScheduleTimeline";
import ThermalHistory from "./ThermalHistory";
import TrustManifest from "./TrustManifest";
import Compatibility from "./Compatibility";
import FinalInstall from "./FinalInstall";
import Faq from "./Faq";
import OpenSource from "./OpenSource";
import SiteFooter from "./SiteFooter";
import StickyInstall from "./StickyInstall";

/**
 * The homepage, as one continuous machine.
 *
 * Boot policy: the full arming sequence plays once per session. A return visit
 * in the same tab gets a short resume instead, and reduced motion skips straight
 * to the usable page. Deep links skip the boot entirely — nobody following an
 * anchor wants to watch a splash first.
 */
export default function GcoolersExperience() {
  const [phase, setPhase] = useState<"pending" | "boot" | "resume" | "done">("pending");

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const seen = (() => {
      try {
        return sessionStorage.getItem(boot.storageKey) === "1";
      } catch {
        // Private browsing can throw on access; treat it as a first visit.
        return false;
      }
    })();

    if (reduced || window.location.hash) {
      setPhase("done");
      return;
    }
    setPhase(seen ? "resume" : "boot");
  }, []);

  const booting = phase === "boot" || phase === "resume";

  useEffect(() => {
    document.body.classList.toggle("is-booting", booting);
    if (booting) window.scrollTo(0, 0);
    return () => document.body.classList.remove("is-booting");
  }, [booting]);

  const onBooted = useCallback(() => {
    try {
      sessionStorage.setItem(boot.storageKey, "1");
    } catch {
      /* nothing to do — the boot simply replays next time */
    }
    setPhase("done");
  }, []);

  const ready = phase === "done";

  return (
    <MotionConfig reducedMotion="user">
      <FrostMachineBackground />
      <LoadingMachine active={booting} resume={phase === "resume"} onDone={onBooted} />
      <Navbar ready={ready} />

      <main id="main">
        <HeroMachine ready={ready} />
        <WhatItDoes />
        <LiveView />
        <ScrollMachine ready={ready} />
        <MeetingMode />
        <MenuBarSection />
        <WidgetSection />
        <ScheduleTimeline />
        <ThermalHistory />
        <TrustManifest />
        <Compatibility />
        <FinalInstall />
        <Faq />
        <OpenSource />
      </main>

      <SiteFooter home />
      {ready && <StickyInstall />}
    </MotionConfig>
  );
}
