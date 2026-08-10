import { useEffect, useRef, useState } from "react";
import Chapter from "./Chapter";
import { adaptive, history, meeting, version } from "../../data/product";
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
    line: "CPU, GPU, and a weighted package peak, straight off the SMC.",
    figure: `every ${profiles[1].readouts.sample}s`,
    detail: "macmon reads the sensors; the governor weights CPU and GPU into one peak figure.",
  },
  {
    key: "govern",
    label: "Govern",
    line: "One fan curve, held between a start point and a ceiling.",
    figure: `${profiles[1].readouts.startsAt}° → ${profiles[1].readouts.fullAt}°F`,
    detail: `Below the start point the fans stay with macOS. Above it the curve takes over from a ${Math.round(
      profiles[1].readouts.baseFan * 100,
    )}% floor.`,
  },
  {
    key: "adapt",
    label: "Adapt",
    line: "Profiles, detected calls, schedules, and a per-workload bias.",
    figure: `${adaptive.range.min * 100}% … +${adaptive.range.max * 100}%`,
    detail: `Bias is stored separately for ${adaptive.buckets.length} workload shapes and moves in ${(
      adaptive.step * 100
    ).toFixed(1)}% steps.`,
  },
  {
    key: "observe",
    label: "Observe",
    line: "An hour of history, MAX events, and dwell-gated alerts.",
    figure: `${history.windowMinutes} min · ${history.maxSamples} samples`,
    detail: "Export the window to CSV and HTML. Alerts are capped at three an hour.",
  },
  {
    key: "local",
    label: "Local",
    line: "A user agent, a menu bar app, and a widget. Nothing else.",
    figure: "no network",
    detail: `Everything lives in ~/Library/Application Support/Gcoolers. v${version} has no account and no telemetry.`,
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
          Read the machine. <span className="serif">Then</span> answer it.
        </>
      }
      lede={
        <p>
          Gcoolers is a governor, not a switch. It samples, decides, acts, and remembers — and every part of
          that loop is visible to you.
        </p>
      }
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
