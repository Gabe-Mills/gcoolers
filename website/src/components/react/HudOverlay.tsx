import { profiles } from "../../data/profiles";
import { CURVE, curvePath, curveTicks } from "./ProfileCurve";

export interface HudRefs {
  startsAt: HTMLElement | null;
  fullAt: HTMLElement | null;
  baseFan: HTMLElement | null;
  sample: HTMLElement | null;
  label: HTMLElement | null;
  curve: SVGPathElement | null;
  bar: HTMLElement | null;
  ticks: (HTMLElement | null)[];
}

interface Props {
  /** ScrollMachine writes readouts straight to these nodes each frame. */
  refs: React.RefObject<HudRefs>;
}

/**
 * Instrument labelling over the pinned stage.
 *
 * The curve is the one element here that is doing real work: as the timeline
 * scrubs, its path is rewritten from interpolated thresholds, so a single fan
 * curve visibly slides left and steepens as Quiet becomes Cool. The readouts
 * beneath it are the same four numbers the governor is built from.
 *
 * Everything in here is aria-hidden. The profile names, lines, and figures are
 * all available as real text in the stacked scenes, so a screen reader gets the
 * content without a stream of decorative numbers.
 */
export default function HudOverlay({ refs }: Props) {
  const set =
    (key: "startsAt" | "fullAt" | "baseFan" | "sample" | "label" | "bar") => (el: HTMLElement | null) => {
      refs.current[key] = el;
    };

  const { w, h, pad } = CURVE;
  const first = profiles[0].readouts;

  return (
    <div className="hud" aria-hidden="true">
      <div className="hud-row">
        <span className="hud-corner">Gcoolers · thermal governor</span>
        <span className="hud-status">
          <i />
          Profile · <b ref={set("label")}>{profiles[0].displayLabel}</b>
        </span>
      </div>

      <div className="hud-mid">
        <div className="hud-curve">
          <p className="hud-curve-label">Fan curve · package °F</p>
          <svg viewBox={`0 0 ${w} ${h}`} className="curve">
            {[0.25, 0.5, 0.75, 1].map((p) => (
              <line
                key={p}
                className="curve-grid"
                x1={pad.l}
                x2={w - pad.r}
                y1={pad.t + (h - pad.t - pad.b) * (1 - p)}
                y2={pad.t + (h - pad.t - pad.b) * (1 - p)}
              />
            ))}
            {curveTicks().map((t) => (
              <g key={t.f}>
                <line className="curve-grid is-v" x1={t.x} x2={t.x} y1={pad.t} y2={h - pad.b} />
                <text className="curve-tick" x={t.x} y={h - pad.b + 16} textAnchor="middle">
                  {t.f}°
                </text>
              </g>
            ))}
            <text className="curve-tick" x={pad.l - 8} y={pad.t + 4} textAnchor="end">
              100%
            </text>
            <path
              ref={(el) => {
                refs.current.curve = el;
              }}
              className="curve-line"
              d={curvePath(first.startsAt, first.fullAt, first.baseFan)}
            />
          </svg>
        </div>
      </div>

      <div className="hud-foot">
        <div className="hud-progress">
          <span ref={set("bar")} />
        </div>
        <div className="hud-row">
          <div className="hud-meters">
            <Meter label="curve starts" unit="°F" nodeRef={set("startsAt")} initial={String(first.startsAt)} />
            <Meter label="fan full at" unit="°F" nodeRef={set("fullAt")} initial={String(first.fullAt)} />
            <Meter label="fan floor" unit="%" nodeRef={set("baseFan")} initial={String(Math.round(first.baseFan * 100))} />
            <Meter label="sample every" unit="s" nodeRef={set("sample")} initial={String(first.sample)} />
          </div>
          <div className="hud-ticks">
            {profiles.map((p, i) => (
              <span
                key={p.id}
                className={`hud-tick${i === 0 ? " is-on" : ""}`}
                ref={(el) => {
                  refs.current.ticks[i] = el;
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Meter({
  label,
  unit,
  initial,
  nodeRef,
}: {
  label: string;
  unit: string;
  initial: string;
  nodeRef: (el: HTMLElement | null) => void;
}) {
  return (
    <div className="hud-meter">
      <span className="mono">{label}</span>
      <b>
        <span ref={nodeRef}>{initial}</span>
        {unit}
      </b>
    </div>
  );
}
