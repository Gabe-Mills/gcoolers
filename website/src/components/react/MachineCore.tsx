import { useMemo } from "react";

const BLADES = 9;
const BLADE_PATH = "M50 50 C58 40 70 34 78.5 31.5 C73 44 63 52.5 52.5 56.5 Z";
const ARC_R = 40;
const ARC_C = 2 * Math.PI * ARC_R;

/** Exported so the scroll timeline can drive the gauge without a re-render. */
export const ARC_CIRCUMFERENCE = ARC_C;
/** The gauge only sweeps three quarters of the ring. */
export const ARC_SWEEP = 0.75;

/** Fan RPM → one blade revolution, in seconds. Faster fan, faster spin. */
function spinDuration(rpm: number) {
  return `${Math.max(0.55, 3.2 - (rpm / 5000) * 2.6).toFixed(2)}s`;
}

interface Props {
  temp?: number;
  rpm?: number;
  /** Fraction of the gauge arc that is lit, 0–1. */
  fill?: number;
  readout?: boolean;
  className?: string;
  /** Refs let the scroll timeline write values without re-rendering React. */
  tempRef?: React.Ref<HTMLElement>;
  bladesRef?: React.Ref<SVGGElement>;
  arcRef?: React.Ref<SVGCircleElement>;
}

export default function MachineCore({
  temp = 68,
  rpm = 2450,
  fill = 0.62,
  readout = true,
  className = "",
  tempRef,
  bladesRef,
  arcRef,
}: Props) {
  const blades = useMemo(() => Array.from({ length: BLADES }, (_, i) => (i * 360) / BLADES), []);

  return (
    <div
      className={`core ${className}`.trim()}
      style={{ "--core-speed": spinDuration(rpm) } as React.CSSProperties}
      aria-hidden="true"
    >
      <div className="core-halo" />

      <svg className="core-svg" viewBox="0 0 100 100">
        <circle className="core-ring" cx="50" cy="50" r="48" />
        <circle className="core-ring" cx="50" cy="50" r="33" opacity="0.55" />
        <circle className="core-ticks" cx="50" cy="50" r="44" />

        <circle
          ref={arcRef}
          className="core-arc"
          cx="50"
          cy="50"
          r={ARC_R}
          strokeDasharray={ARC_C}
          strokeDashoffset={ARC_C * (1 - fill * 0.75)}
          transform="rotate(135 50 50)"
        />

        <g ref={bladesRef} className="core-blades">
          {blades.map((deg) => (
            <path key={deg} className="core-blade" d={BLADE_PATH} transform={`rotate(${deg} 50 50)`} />
          ))}
        </g>

        <g className="core-sweep">
          <line
            x1="50"
            y1="50"
            x2="50"
            y2="6"
            stroke="var(--core)"
            strokeWidth="0.4"
            opacity="0.45"
          />
        </g>

        <circle className="core-hub" cx="50" cy="50" r="4.2" />
      </svg>

      {readout && (
        <div className="core-readout">
          <b ref={tempRef as React.Ref<HTMLElement>}>{Math.round(temp)}°</b>
          <small>package</small>
        </div>
      )}
    </div>
  );
}
