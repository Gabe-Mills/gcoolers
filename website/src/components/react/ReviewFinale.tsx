import { useEffect, useMemo, useRef, useState } from "react";
import { useIsomorphicLayoutEffect, useReducedMotion } from "../../lib/hooks";
import type { Review, ReviewStats } from "../../lib/reviews";

/**
 * The end sequence.
 *
 * Reports become signal nodes, the nodes wire themselves into a sensor network,
 * their star pulses travel inward and feed the thermal core, the core takes the
 * energy and frost-locks, and what rebuilds out of it is the Gcoolers mark with
 * the community arranged around it.
 *
 * Three rules held throughout:
 *
 * 1. The stage is held by CSS `position: sticky`, not by ScrollTrigger's `pin`.
 *    Pinning reparents the DOM into a pin-spacer, and React then throws on
 *    removeChild when the breakpoint swaps the layout. This is the same trap
 *    the profile machine already fell into once.
 * 2. Scroll is never trapped. The whole thing is a scrub over normal page
 *    height — flick past it and nothing catches.
 * 3. Nothing here carries information that is not also on the page in text. The
 *    closing message and both CTAs are ordinary DOM, readable with the timeline
 *    at progress zero and with animation off entirely.
 *
 * Spectacle comes from timing, depth and restraint. There is no confetti, no
 * hue cycling, and no strobing: the brightest moment is a single frost lock
 * that eases over roughly a second.
 */

const MAX_NODES = 40;
const EMPTY_NODES = 18;

interface Node {
  x: number;
  y: number;
  r: number;
  rating: number;
  /** Decorative nodes are drawn dimmer and are never described as people. */
  real: boolean;
}

/**
 * Deterministic layout. A seeded hash rather than Math.random so the same
 * reviews always produce the same constellation — a network that reshuffles
 * on every reload reads as noise rather than as a picture of something.
 */
function seeded(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function buildNodes(reviews: Review[], total: number): Node[] {
  const count = Math.max(Math.min(total || reviews.length, MAX_NODES), 0);
  const nodes: Node[] = [];
  const n = count || EMPTY_NODES;

  for (let i = 0; i < n; i++) {
    // Golden-angle spiral, pushed outward, then jittered so it reads as an
    // organic sensor field rather than a sunflower.
    const angle = i * 2.399963;
    const radius = 78 + Math.sqrt(i / n) * 230;
    const jitter = (seeded(i, 3) - 0.5) * 46;
    const rating = reviews[i]?.rating ?? 0;
    nodes.push({
      x: 320 + Math.cos(angle) * (radius + jitter),
      y: 260 + Math.sin(angle) * (radius + jitter) * 0.62,
      r: rating ? 2.4 + rating * 0.5 : 2.2,
      rating,
      real: i < reviews.length,
    });
  }
  return nodes;
}

/** Links each node to its nearest already-placed neighbour: a spanning web. */
function buildLinks(nodes: Node[]): Array<[Node, Node]> {
  const links: Array<[Node, Node]> = [];
  for (let i = 1; i < nodes.length; i++) {
    let best = 0;
    let bestDist = Infinity;
    for (let j = 0; j < i; j++) {
      const d = (nodes[i].x - nodes[j].x) ** 2 + (nodes[i].y - nodes[j].y) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = j;
      }
    }
    links.push([nodes[i], nodes[best]]);
  }
  return links;
}

export default function ReviewFinale({
  reviews,
  stats,
}: {
  reviews: Review[];
  stats: ReviewStats;
}) {
  const reduced = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [narrow, setNarrow] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 880px)");
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const hasReports = stats.total > 0;
  const nodes = useMemo(() => buildNodes(reviews, stats.total), [reviews, stats.total]);
  const links = useMemo(() => buildLinks(nodes), [nodes]);

  // Mobile gets a shorter, simpler run: the same beats, less scroll spent.
  const heightVh = narrow ? 170 : 320;
  const animate = narrow === false && !reduced;

  useIsomorphicLayoutEffect(() => {
    if (!animate) return;
    const wrap = wrapRef.current;
    const stage = stageRef.current;
    if (!wrap || !stage) return;

    let cleanup = () => {};
    let cancelled = false;

    (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([import("gsap"), import("gsap/ScrollTrigger")]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);

      const ctx = gsap.context(() => {
        const q = gsap.utils.selector(stage);
        const nodeEls = q(".fin-node");
        const linkEls = q(".fin-link");
        const pulseEls = q(".fin-pulse");

        gsap.set(nodeEls, { opacity: 0, scale: 0.2, transformOrigin: "center" });
        // Lines are drawn with stroke-dashoffset rather than GSAP's DrawSVG,
        // which is a paid plugin this project does not license.
        linkEls.forEach((el) => {
          // gsap.utils.selector types its result as the union of every element
          // Astro knows about; these are the <path>s rendered a few lines below.
          const path = el as unknown as SVGPathElement;
          const length = path.getTotalLength();
          gsap.set(path, { strokeDasharray: length, strokeDashoffset: length, opacity: 0.55 });
        });
        gsap.set(pulseEls, { opacity: 0 });
        gsap.set(q(".fin-core-ring"), { scale: 0.6, opacity: 0, transformOrigin: "center" });
        gsap.set(q(".fin-mark"), { opacity: 0, scale: 0.82, transformOrigin: "center" });
        gsap.set(q(".fin-frost"), { opacity: 0, scale: 0.4, transformOrigin: "center" });
        gsap.set(q(".fin-closing"), { opacity: 0, y: 26 });

        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: wrap,
            start: "top top",
            end: "bottom bottom",
            scrub: 1.05,
          },
        });

        // 1 — reports arrive as signal nodes.
        tl.to(nodeEls, { opacity: 1, scale: 1, stagger: { each: 0.012, from: "random" }, duration: 0.9, ease: "power2.out" }, 0);

        // 2 — the network wires itself together.
        tl.to(linkEls, { strokeDashoffset: 0, stagger: 0.006, duration: 0.7, ease: "power1.inOut" }, 0.55);

        // 3 — star pulses travel inward and feed the core.
        tl.to(pulseEls, { opacity: 1, duration: 0.12 }, 1.15);
        tl.to(pulseEls, { attr: { cx: 320, cy: 260 }, stagger: { each: 0.01, from: "edges" }, duration: 0.85, ease: "power2.in" }, 1.2);
        tl.to(pulseEls, { opacity: 0, duration: 0.2 }, 1.95);
        tl.to(q(".fin-core"), { attr: { r: 34 }, duration: 0.8, ease: "power2.in" }, 1.25);

        // 4 — implosion, then the frost lock. One bright beat, eased, never a
        // flash: opacity ramps over ~0.5s of scrub rather than snapping.
        tl.to(q(".fin-core"), { attr: { r: 8 }, duration: 0.25, ease: "power3.in" }, 2.05);
        tl.to(q(".fin-frost"), { opacity: 1, scale: 1.25, duration: 0.5, ease: "power2.out" }, 2.15);
        tl.to(q(".fin-frost"), { opacity: 0, duration: 0.45, ease: "power1.inOut" }, 2.6);
        tl.to(linkEls, { opacity: 0.14, duration: 0.4 }, 2.2);

        // 5 — the mark rebuilds out of it.
        tl.to(q(".fin-core-ring"), { opacity: 1, scale: 1, duration: 0.6, ease: "power2.out" }, 2.45);
        tl.to(q(".fin-mark"), { opacity: 1, scale: 1, duration: 0.6, ease: "power2.out" }, 2.6);

        // 6 — the community settles into a constellation around it.
        tl.to(nodeEls, { opacity: 0.9, duration: 0.5, stagger: { each: 0.01, from: "center" }, ease: "power1.out" }, 2.8);
        tl.to(q(".fin-closing"), { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }, 3.0);
      }, stage);

      cleanup = () => ctx.revert();
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [animate, nodes.length]);

  const headline = hasReports
    ? "Every report above is one machine, running quieter."
    : "The network is listening.";

  const support = hasReports
    ? `${stats.total} field report${stats.total === 1 ? "" : "s"} from people running Gcoolers on their own hardware. Yours would join them.`
    : "No reports have been published yet. The sensors below are decoration — when this constellation fills in, every point on it will be somebody who actually ran the governor and wrote about it.";

  return (
    <section className="finale" id="community" aria-labelledby="finale-title">
      <div className="finale-scroll" ref={wrapRef} style={{ height: `${heightVh}svh` }}>
        <div className="finale-stage" ref={stageRef}>
          <svg
            className="finale-svg"
            viewBox="0 0 640 520"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
            focusable="false"
          >
            <g className="fin-links">
              {links.map(([a, b], i) => (
                <path key={i} className="fin-link" d={`M${a.x.toFixed(1)} ${a.y.toFixed(1)} L${b.x.toFixed(1)} ${b.y.toFixed(1)}`} />
              ))}
            </g>

            <g className="fin-nodes">
              {nodes.map((n, i) => (
                <circle
                  key={i}
                  className={`fin-node${n.real ? " is-real" : " is-idle"}`}
                  cx={n.x.toFixed(1)}
                  cy={n.y.toFixed(1)}
                  r={n.r.toFixed(2)}
                />
              ))}
            </g>

            <g className="fin-pulses">
              {nodes.slice(0, MAX_NODES).map((n, i) => (
                <circle key={i} className="fin-pulse" cx={n.x.toFixed(1)} cy={n.y.toFixed(1)} r="1.8" />
              ))}
            </g>

            <circle className="fin-frost" cx="320" cy="260" r="60" />
            <circle className="fin-core" cx="320" cy="260" r="18" />
            <circle className="fin-core-ring" cx="320" cy="260" r="46" fill="none" />
            <g className="fin-mark">
              <circle cx="320" cy="260" r="30" fill="none" />
              <path d="M334 248a17 17 0 1 0 4 12h-14" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          </svg>

          <div className="finale-copy fin-closing">
            <p className="mono">
              {hasReports ? "Community · signal" : "Community · awaiting signal"}
            </p>
            <h2 id="finale-title">{headline}</h2>
            <p>{support}</p>
            <div className="btn-row">
              <a className="btn btn-primary" href="/reviews/new">
                New field report
              </a>
              <a className="btn btn-ghost" href="/#install">
                Install Gcoolers
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
