import FrostMachineBackground from "./FrostMachineBackground";
import Navbar from "./Navbar";
import HeroMachine from "./HeroMachine";
import FinalInstall from "./FinalInstall";
import Faq from "./Faq";
import SiteFooter from "./SiteFooter";

/**
 * Homepage — short page: live footage, install, FAQ.
 * No boot splash, no scroll chapters.
 */
export default function GcoolersExperience() {
  return (
    <>
      <FrostMachineBackground />
      <Navbar ready />

      <main id="main">
        <HeroMachine ready />
        <FinalInstall />
        <Faq />
      </main>

      <SiteFooter home />
    </>
  );
}
