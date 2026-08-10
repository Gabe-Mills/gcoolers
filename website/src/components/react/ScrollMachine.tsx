import { useEffect, useRef, useState } from "react";
import { profiles } from "../../data/profiles";
import { STAGE_VH } from "../../data/scenes";
import { lerp } from "../../lib/telemetry";
import { useIsomorphicLayoutEffect, useReducedMotion } from "../../lib/hooks";
import MachineCore, { ARC_CIRCUMFERENCE, ARC_SWEEP } from "./MachineCore";
import ProfileModule from "./ProfileModule";
import HudOverlay, { type HudRefs } from "./HudOverlay";
import { curvePath } from "./ProfileCurve";

interface Props {
  ready: boolean;
}

/**
 * The profile machine.
 *
 * Still the signature interaction, with three changes.
 *
 * 1. The pin is 300svh rather than 450 — the sequence had been costing four and
 *    a half screens of scrolling to deliver three headlines.
 * 2. What interpolates is the governor's real configuration, so the fan curve
 *    physically slides and steepens as Quiet becomes Cool.
 * 3. Phones and reduced-motion get the stacked scenes instead. Pinning against
 *    a viewport that resizes as Mobile Safari's chrome moves is the fastest way
 *    to a broken sequence, and three well-made scenes read better anyway.
 */
export default function ScrollMachine({ ready }: Props) {
  const reduced = useReducedMotion();
  const wrapRef = useRef<HTMLElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const moduleRefs = useRef<(HTMLDivElement | null)[]>([]);
  const arcRef = useRef<SVGCircleElement | null>(null);
  const [narrow, setNarrow] = useState<boolean | null>(null);

  const hud = useRef<HudRefs>({
    startsAt: null,
    fullAt: null,
    baseFan: null,
    sample: null,
    label: null,
    curve: null,
    bar: null,
    ticks: [],
  });

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 880px)");
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const pinned = narrow === false && !reduced;

  // Layout effect so the modules are posed before the first paint.
  useIsomorphicLayoutEffect(() => {
    if (!pinned) return;
    const wrap = wrapRef.current;
    const stage = stageRef.current;
    if (!wrap || !stage) return;

    let cleanup = () => {};
    let cancelled = false;

    (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);

      const root = document.documentElement;
      const stageStyle = stage.style;
      const modules = moduleRefs.current.filter(Boolean) as HTMLDivElement[];

      // The page's resting identity, and the only value this section is allowed
      // to leave behind: Balanced's icy cyan, which is exactly what global.css
      // declares for --core-*. Handing the environment back means easing here
      // first, then dropping the inline values entirely.
      const rest = profiles[1].core; // oklch(.84 .12 208)

      const clearEnvironment = () => {
        root.style.removeProperty("--core-l");
        root.style.removeProperty("--core-c");
        root.style.removeProperty("--core-h");
        root.style.removeProperty("--core-intensity");
      };

      // Depth pose for a module that has not arrived yet: further away, tilted
      // back, and fogged. Modules leave the other way — toward the viewer.
      const behind = { opacity: 0, filter: "blur(26px)", yPercent: 14, scale: 0.9, rotateX: 8 };
      const front = { opacity: 0, filter: "blur(30px)", yPercent: -10, scale: 1.12, rotateX: -6 };
      const held = { opacity: 1, filter: "blur(0px)", yPercent: 0, scale: 1, rotateX: 0 };

      const ctx = gsap.context(() => {
        gsap.set(modules, behind);
        gsap.set(modules[0], held);

        // Does this section currently own the global environment? Only while it
        // does may paint() write to :root. Off screen, the page keeps its own
        // cyan rather than being repainted from wherever the sequence is parked.
        let owns = false;

        // Handing the environment back is a move, not a cut: the frost and the
        // core ease to the page default over about a second instead of snapping
        // out of Cool's amber the instant the section ends.
        function holdEnvironment(next: boolean, progress = 0) {
          owns = next;
          // Re-entering cancels an in-flight hand-back, so a release tween and a
          // live scrub can never write --core-* against each other.
          gsap.killTweensOf(root);
          // ScrollTrigger runs onUpdate *before* the toggle callbacks, so the
          // update that enters the section paints while `owns` is still false.
          // Without this the environment stays on the page cyan until the next
          // scroll event — which never arrives if the section was entered by a
          // jump: an anchor link, or a reload that restores scroll mid-section.
          if (next) return paint(progress);
          gsap.to(root, {
            duration: 0.9,
            ease: "power2.out",
            "--core-l": rest.l,
            "--core-c": rest.c,
            "--core-h": rest.h,
            "--core-intensity": 0.55,
            onComplete: () => {
              // Back to the stylesheet's own values, so nothing inline lingers.
              if (!owns) clearEnvironment();
            },
          });
        }

        function paint(progress: number) {
          const span = profiles.length - 1;
          const seg = Math.min(Math.max(progress, 0), 1) * span;
          const i0 = Math.min(Math.floor(seg), span - 1);
          const t = seg - i0;
          const a = profiles[i0];
          const b = profiles[i0 + 1];

          const startsAt = lerp(a.readouts.startsAt, b.readouts.startsAt, t);
          const fullAt = lerp(a.readouts.fullAt, b.readouts.fullAt, t);
          const baseFan = lerp(a.readouts.baseFan, b.readouts.baseFan, t);
          const sample = lerp(a.readouts.sample, b.readouts.sample, t);

          // --- The HUD, always. paint(0) still has to pose the readouts, the
          // curve, the label and the ticks before the section is ever reached,
          // and every write below this line is scoped to the stage, not to :root.

          // Fan floor drives the blade speed: a higher floor is a faster fan.
          stageStyle.setProperty("--core-speed", `${Math.max(0.6, 3.4 - baseFan * 4.2).toFixed(2)}s`);

          if (arcRef.current) {
            const fill = (fullAt - 130) / 25;
            arcRef.current.style.strokeDashoffset = String(
              ARC_CIRCUMFERENCE * (1 - Math.min(Math.max(fill, 0), 1) * ARC_SWEEP),
            );
          }

          const h = hud.current;
          if (h.startsAt) h.startsAt.textContent = String(Math.round(startsAt));
          if (h.fullAt) h.fullAt.textContent = String(Math.round(fullAt));
          if (h.baseFan) h.baseFan.textContent = String(Math.round(baseFan * 100));
          if (h.sample) h.sample.textContent = String(Math.round(sample));
          if (h.curve) h.curve.setAttribute("d", curvePath(startsAt, fullAt, baseFan));
          if (h.bar) h.bar.style.transform = `scaleX(${progress.toFixed(4)})`;

          const active = Math.round(seg);
          if (h.label) h.label.textContent = profiles[active].displayLabel;
          h.ticks.forEach((tick, i) => tick?.classList.toggle("is-on", i === active));

          // --- The environment, only while this section is on screen. paint(0)
          // runs at page load and profile 01 is hue 158, so writing these
          // unconditionally is what used to open the page on Quiet's green
          // instead of the identity cyan.
          if (!owns) return;

          root.style.setProperty("--core-l", lerp(a.core.l, b.core.l, t).toFixed(3));
          root.style.setProperty("--core-c", lerp(a.core.c, b.core.c, t).toFixed(3));
          root.style.setProperty("--core-h", lerp(a.core.h, b.core.h, t).toFixed(1));
          root.style.setProperty("--core-intensity", (0.34 + baseFan * 0.5).toFixed(3));
        }

        const tl = gsap.timeline({
          defaults: { ease: "none" },
          // No `pin` here: the stage is held by CSS sticky instead, so
          // ScrollTrigger never reparents DOM that React owns. See .machine-stage.
          scrollTrigger: {
            trigger: wrap,
            start: "top top",
            end: "bottom bottom",
            scrub: 1.1,
            onUpdate: (self) => paint(self.progress),
            // The environment is only this section's to drive while the section
            // is the thing on screen. Outside it, the page keeps its own cyan.
            onEnter: (self) => holdEnvironment(true, self.progress),
            onEnterBack: (self) => holdEnvironment(true, self.progress),
            onLeave: () => holdEnvironment(false),
            onLeaveBack: () => holdEnvironment(false),
          },
        });

        // Arrivals decelerate into place, departures accelerate away, so the two
        // modules in play are never equally resolved at the same moment.
        modules.forEach((el, i) => {
          if (i > 0) tl.fromTo(el, behind, { ...held, duration: 1, ease: "power2.out" }, i * 2);
          if (i < modules.length - 1) tl.to(el, { ...front, duration: 1, ease: "power2.in" }, i * 2 + 1);
        });

        paint(0);
      }, wrap);

      cleanup = () => {
        ctx.revert();
        // The hand-back tween is created after the context callback has already
        // run, so it is not one of the animations ctx.revert() knows about.
        gsap.killTweensOf(root);
        clearEnvironment();
      };
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [pinned]);

  // The boot overlay locks scroll; measurements are only valid once it clears.
  useEffect(() => {
    if (!pinned || !ready) return;
    let cancelled = false;
    const id = window.setTimeout(async () => {
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      if (!cancelled) ScrollTrigger.refresh();
    }, 240);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [pinned, ready]);

  const header = (
    <div className="wrap machine-intro">
      <p className="chapter-rail" aria-hidden="true">
        <b>04</b>
        <i />
      </p>
      <p className="chapter-eyebrow mono">Profiles</p>
      <h2 className="chapter-title">
        One governor. Three <span className="serif">strategies</span>.
      </h2>
      <p className="chapter-lede">
        A profile is not a preset label — it is four numbers that move the whole fan curve. Watch where each
        one decides the fans are worth waking.
      </p>
    </div>
  );

  // Stacked scenes: mobile, reduced motion, and the pre-hydration render.
  if (!pinned) {
    return (
      <section className="machine is-static" id="profiles" aria-labelledby="profiles-title">
        {header}
        <h3 className="sr-only" id="profiles-title">
          Thermal profiles
        </h3>
        <div className="static-board">
          {profiles.map((profile) => (
            <ProfileModule key={profile.id} profile={profile} variant="static" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="machine" id="profiles" aria-labelledby="profiles-title">
      {header}
      <h3 className="sr-only" id="profiles-title">
        Thermal profiles
      </h3>

      <div className="machine-scroll" ref={wrapRef} style={{ height: `${STAGE_VH}svh` }}>
        <div className="machine-stage" ref={stageRef}>
          <MachineCore className="machine-stage-core" readout={false} arcRef={arcRef} />

          <div className="machine-plate" aria-hidden="true" />

          {profiles.map((profile, i) => (
            <ProfileModule
              key={profile.id}
              profile={profile}
              ref={(el) => {
                moduleRefs.current[i] = el;
              }}
            />
          ))}

          <HudOverlay refs={hud} />
        </div>
      </div>
    </section>
  );
}
