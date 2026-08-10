import { useMemo } from "react";
import type { Profile } from "../../data/profiles";
import { curveFanPct } from "../../lib/telemetry";

/**
 * The fan curve itself.
 *
 * Plotted from `curve_fan_pct` — a `base + (1 - base) * t^1.2` ramp between the
 * profile's start point and its ceiling — over a fixed 100–160°F axis, so the
 * three profiles are directly comparable: Cool's curve sits visibly left and
 * high of Quiet's because those are the numbers in the source.
 *
 * A single plot of a real transfer function is worth more than any amount of
 * copy about "intelligent cooling", and it is a visual that could not belong to
 * any other product.
 */

export const CURVE = { w: 460, h: 210, pad: { t: 14, r: 16, b: 30, l: 34 } };
const AXIS = { lo: 100, hi: 160 };
const STEPS = 40;

export function curvePath(startsAt: number, fullAt: number, baseFan: number) {
  const { w, h, pad } = CURVE;
  const x = (f: number) => pad.l + ((w - pad.l - pad.r) * (f - AXIS.lo)) / (AXIS.hi - AXIS.lo);
  const y = (p: number) => pad.t + (h - pad.t - pad.b) * (1 - p);

  const pts: string[] = [`M${x(AXIS.lo).toFixed(1)} ${y(0).toFixed(1)}`];
  // Flat at zero until the curve engages — below the start point the fans are
  // still macOS's problem, and the plot should show that gap.
  pts.push(`L${x(startsAt).toFixed(1)} ${y(0).toFixed(1)}`);
  pts.push(`L${x(startsAt).toFixed(1)} ${y(baseFan).toFixed(1)}`);
  for (let i = 1; i <= STEPS; i++) {
    const f = startsAt + ((fullAt - startsAt) * i) / STEPS;
    pts.push(`L${x(f).toFixed(1)} ${y(curveFanPct(f, startsAt, fullAt, baseFan)).toFixed(1)}`);
  }
  pts.push(`L${x(AXIS.hi).toFixed(1)} ${y(1).toFixed(1)}`);
  return pts.join(" ");
}

export function curveTicks() {
  const { w, pad } = CURVE;
  const x = (f: number) => pad.l + ((w - pad.l - pad.r) * (f - AXIS.lo)) / (AXIS.hi - AXIS.lo);
  return [100, 115, 130, 145, 160].map((f) => ({ f, x: x(f) }));
}

export default function ProfileCurve({ profile }: { profile: Profile }) {
  const { startsAt, fullAt, baseFan } = profile.readouts;
  const d = useMemo(() => curvePath(startsAt, fullAt, baseFan), [startsAt, fullAt, baseFan]);
  const { w, h, pad } = CURVE;

  return (
    <svg
      className="curve"
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={`${profile.name} fan curve: idle below ${startsAt} degrees Fahrenheit, ${Math.round(
        baseFan * 100,
      )} percent at the start point, full at ${fullAt} degrees.`}
    >
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
      <text className="curve-tick" x={pad.l - 8} y={h - pad.b} textAnchor="end">
        0
      </text>

      <path className="curve-line" d={d} />
    </svg>
  );
}
