import { useEffect, useRef, useState } from "react";
import Chapter from "./Chapter";
import { adaptive, history, version } from "../../data/product";
import { profiles } from "../../data/profiles";
import { useInView } from "../../lib/hooks";

/**
 * What Gcoolers does, as one instrument rather than a card grid.
 *
 * Five stages of the same loop, laid along a single horizontal bus. The active
 * stage lights the bus segment behind it; hovering or focusing a stage moves the
 * light, so reading the section is the same gesture as tracing a signal path.
 * Each stage is captioned with a real figure, not an adjective.
 */

const stages = [
  {
    key: "monitor",
    label: "Monitor",
    line: "CPU, GPU, package peak from the SMC.",
    figure: `every ${profiles[1].readouts.sample}s`,
    detail: "Weighted peak from live sensors.",
  },
  {
    key: "govern",
    label: "Govern",
    line: "One curve between a floor and a ceiling.",
    figure: `${profiles[1].readouts.startsAt}° → ${profiles[1].readouts.fullAt}°F`,
    detail: `Engages above ${profiles[1].readouts.startsAt}°F.`,
  },
  {
    key: "adapt",
    label: "Adapt",
    line: "Profiles, calls, schedule, workload bias.",
    figure: `${adaptive.range.min * 100}% … +${adaptive.range.max * 100}%`,
    detail: `${adaptive.buckets.length} workload buckets.`,
  },
  {
    key: "observe",
    label: "Observe",
    line: "Hour history, MAX events, alerts.",
    figure: `${history.windowMinutes} min · ${history.maxSamples} samples`,
    detail: "Export CSV/HTML. Max 3 alerts/hour.",
  },
  {
    key: "local",
    label: "Local",
    line: "Daemon, menu bar, widget. No network.",
    figure: "no network",
    detail: `v${version} · local files only.`,
  },
] as const;

export default function WhatItDoes() {
  const [active, setActive] = useState(0);
  const [busRef, busSeen] = useInView<HTMLDivElement>();
  const paused = useRef(false);

  // The bus cycles on its own so the section is alive before it is touched, and
  // stops the moment a pointer or keyboard takes over.
  useEffect(() => {
    if (!busSeen) return;
    const id = window.setInterval(() => {
      if (!paused.current) setActive((i) => (i + 1) % stages.length);
    }, 2600);
    return () => window.clearInterval(id);
  }, [busSeen]);

  return (
    <Chapter
      id="features"
      index="02"
      eyebrow="The loop"
      title={
        <>
          Sample. Decide. <span className="serif">Act.</span>
        </>
      }
      lede={<p>A governor, not a switch — and every step is visible.</p>}
      wide
    >
      <div className="loop" ref={busRef}>
        <div className="loop-bus" aria-hidden="true">
          <span
            className="loop-bus-lit"
            style={{
              transform: `translateX(${active * 100}%)`,
              width: `${100 / stages.length}%`,
            }}
          />
        </div>

        <ol className="loop-stages">
          {stages.map((s, i) => (
            <li key={s.key}>
              <button
                type="button"
                className={`loop-stage${i === active ? " is-on" : ""}`}
                aria-pressed={i === active}
                onMouseEnter={() => {
                  paused.current = true;
                  setActive(i);
                }}
                onMouseLeave={() => {
                  paused.current = false;
                }}
                onFocus={() => {
                  paused.current = true;
                  setActive(i);
                }}
                onBlur={() => {
                  paused.current = false;
                }}
                onClick={() => setActive(i)}
              >
                <span className="loop-node" aria-hidden="true" />
                <span className="loop-index mono">{String(i + 1).padStart(2, "0")}</span>
                <span className="loop-label">{s.label}</span>
                <span className="loop-line">{s.line}</span>
                <span className="loop-figure mono">{s.figure}</span>
              </button>
            </li>
          ))}
        </ol>

        <p className="loop-detail" aria-live="polite">
          {stages[active].detail}
        </p>
      </div>
    </Chapter>
  );
}
