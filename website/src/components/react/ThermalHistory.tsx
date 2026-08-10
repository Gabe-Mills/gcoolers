import { useMemo, useState } from "react";
import Chapter from "./Chapter";
import { alerts, history } from "../../data/product";
import { profiles } from "../../data/profiles";
import { curveFanPct, thermalBand, weightedPeak } from "../../lib/telemetry";
import { useInView } from "../../lib/hooks";

/**
 * Thermal history and alerts.
 *
 * A real plot, not an illustration: the same hour window the daemon keeps, the
 * same band thresholds, the same event rule (only MAX transitions are recorded).
 * The series is generated deterministically so the chart is stable between
 * renders and the caption is explicit that it is a demonstration — there is no
 * claim being made about a temperature drop.
 */

const W = 900;
const H = 300;
const PAD = { t: 26, r: 20, b: 34, l: 44 };

interface Sample {
  minute: number;
  peak: number;
  cpu: number;
  gpu: number;
  fan: number;
}

/** One hour at the balanced profile's 20s cadence, thinned to a readable series. */
function buildHour(): Sample[] {
  const p = profiles[1];
  const out: Sample[] = [];
  for (let i = 0; i <= 120; i++) {
    const minute = (i / 120) * history.windowMinutes;
    // A build kicking off at minute 14, a render at 34, then a long cooldown.
    const ramp1 = Math.exp(-((minute - 20) ** 2) / 90);
    const ramp2 = Math.exp(-((minute - 38) ** 2) / 44);
    const idle = 0.18 + 0.1 * Math.sin(minute * 0.45);
    const load = Math.min(1, idle + ramp1 * 0.72 + ramp2 * 0.95);
    const cpu = 104 + load * 46 + Math.sin(minute * 1.7) * 1.2;
    const gpu = 100 + load * 41 + Math.sin(minute * 1.1 + 1) * 2.2;
    const peak = weightedPeak(cpu, gpu, p.facts.weights.cpu, p.facts.weights.gpu);
    const fan = peak >= p.readouts.startsAt ? curveFanPct(peak, p.readouts.startsAt, p.readouts.fullAt, p.readouts.baseFan) : 0;
    out.push({ minute, peak, cpu, gpu, fan });
  }
  return out;
}

export default function ThermalHistory() {
  const [ref, seen] = useInView<HTMLDivElement>("-18% 0px");
  const [hover, setHover] = useState<Sample | null>(null);

  const { samples, lo, hi, peakPath, cpuPath, gpuPath, fanPath, events } = useMemo(() => {
    const samples = buildHour();
    const all = samples.flatMap((s) => [s.cpu, s.gpu, s.peak]);
    const lo = Math.floor(Math.min(...all) / 5) * 5 - 2;
    const hi = Math.ceil(Math.max(...all) / 5) * 5 + 2;

    const x = (m: number) => PAD.l + ((W - PAD.l - PAD.r) * m) / history.windowMinutes;
    const y = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - (v - lo) / (hi - lo));
    const line = (key: keyof Sample) =>
      samples.map((s, i) => `${i ? "L" : "M"}${x(s.minute).toFixed(1)} ${y(s[key] as number).toFixed(1)}`).join(" ");

    const fanPath = samples
      .map((s, i) => {
        const fy = PAD.t + (H - PAD.t - PAD.b) * (1 - s.fan);
        return `${i ? "L" : "M"}${x(s.minute).toFixed(1)} ${fy.toFixed(1)}`;
      })
      .join(" ");

    // history_append() only records an event when the zone reads MAX.
    const events: { minute: number; peak: number }[] = [];
    samples.forEach((s) => {
      if (s.fan >= 0.97 && !events.some((e) => s.minute - e.minute < 1.5)) {
        events.push({ minute: s.minute, peak: s.peak });
      }
    });

    return { samples, lo, hi, peakPath: line("peak"), cpuPath: line("cpu"), gpuPath: line("gpu"), fanPath, events };
  }, []);

  const x = (m: number) => PAD.l + ((W - PAD.l - PAD.r) * m) / history.windowMinutes;
  const y = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - (v - lo) / (hi - lo));

  // Band thresholds that fall inside the visible range get a rule.
  const bandLines = [130, 145, 160].filter((b) => b > lo && b < hi);

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = ((e.clientX - rect.left) / rect.width) * W;
    const minute = ((rel - PAD.l) / (W - PAD.l - PAD.r)) * history.windowMinutes;
    const s = samples.reduce((best, cur) =>
      Math.abs(cur.minute - minute) < Math.abs(best.minute - minute) ? cur : best,
    );
    setHover(s);
  };

  const readout = hover ?? samples[samples.length - 1];
  const band = thermalBand(readout.peak);

  return (
    <Chapter
      id="history"
      index="09"
      eyebrow="History · alerts"
      title={
        <>
          Last hour. <span className="serif">On disk.</span>
        </>
      }
      lede={
        <p>
          {history.windowMinutes} min · {history.maxSamples} samples.{" "}
          <code className="code-inline">gcoolers export</code> → Downloads.
        </p>
      }
      wide
    >
      <div className={`hist${seen ? " is-seen" : ""}`} ref={ref}>
        <div className="hist-chart panel">
          <div className="hist-chart-head">
            <span className="mono">Last {history.windowMinutes} minutes · package peak</span>
            <span className="hist-legend">
              <b className="k-peak">peak</b>
              <b className="k-cpu">cpu</b>
              <b className="k-gpu">gpu</b>
              <b className="k-fan">fan %</b>
            </span>
          </div>

          <svg
            className="hist-svg"
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={`Thermal history demonstration. Package peak rises from about ${Math.round(
              Math.min(...samples.map((s) => s.peak)),
            )} to ${Math.round(Math.max(...samples.map((s) => s.peak)))} degrees Fahrenheit across one hour, with ${
              events.length
            } moments at maximum fan.`}
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
          >
            {bandLines.map((b) => (
              <g key={b}>
                <line className="hist-band" x1={PAD.l} x2={W - PAD.r} y1={y(b)} y2={y(b)} />
                <text className="hist-band-label" x={PAD.l - 8} y={y(b) + 3.5} textAnchor="end">
                  {b}°
                </text>
              </g>
            ))}

            {[0, 15, 30, 45, 60].map((m) => (
              <g key={m}>
                <line className="hist-grid" x1={x(m)} x2={x(m)} y1={PAD.t} y2={H - PAD.b} />
                <text className="hist-tick" x={x(m)} y={H - PAD.b + 18} textAnchor="middle">
                  {m === 0 ? "−60m" : m === 60 ? "now" : `−${60 - m}m`}
                </text>
              </g>
            ))}

            <path className="hist-fan" d={fanPath} />
            <path className="hist-gpu" d={gpuPath} />
            <path className="hist-cpu" d={cpuPath} />
            <path className="hist-peak" d={peakPath} />

            {events.map((e) => (
              <g key={e.minute} className="hist-event">
                <line x1={x(e.minute)} x2={x(e.minute)} y1={PAD.t} y2={H - PAD.b} />
                <circle cx={x(e.minute)} cy={y(e.peak)} r="3.4" />
              </g>
            ))}

            {hover && (
              <line className="hist-cursor" x1={x(hover.minute)} x2={x(hover.minute)} y1={PAD.t} y2={H - PAD.b} />
            )}
          </svg>

          <dl className="hist-readout" aria-live="off">
            <div>
              <dt className="mono">peak</dt>
              <dd className={`tone-${band.tone}`}>{readout.peak.toFixed(1)}°F</dd>
            </div>
            <div>
              <dt className="mono">cpu</dt>
              <dd>{readout.cpu.toFixed(1)}°F</dd>
            </div>
            <div>
              <dt className="mono">gpu</dt>
              <dd>{readout.gpu.toFixed(1)}°F</dd>
            </div>
            <div>
              <dt className="mono">fan</dt>
              <dd>{Math.round(readout.fan * 100)}%</dd>
            </div>
            <div>
              <dt className="mono">band</dt>
              <dd className={`tone-${band.tone}`}>{band.label}</dd>
            </div>
          </dl>

          <p className="hist-caption mono">
            Demonstration · a synthetic hour rendered through the real curve and the real band thresholds
          </p>
        </div>

        <div className="hist-side">
          <div className="hist-alerts">
            <p className="mono">Alerts</p>
            <ul>
              {alerts.kinds.map((a) => (
                <li key={a.title}>
                  <b>{a.title}</b>
                  <span>{a.gate}</span>
                </li>
              ))}
            </ul>
            <p className="hist-alerts-note">
              Dwell-gated on purpose: at most {alerts.maxPerHour} an hour with a {alerts.cooldownMinutes}-minute
              cooldown, so a fan that briefly spikes never becomes a notification.
            </p>
          </div>

          <div className="hist-export">
            <p className="mono">Export</p>
            <div className="cmd-static">
              <span className="cmd-prompt" aria-hidden="true">
                $
              </span>
              <code>gcoolers export</code>
            </div>
            <p>
              CSV with {history.csvColumns.length} columns — {history.csvColumns.join(", ")} — plus a
              self-contained HTML chart of the same window with its MAX events listed underneath.
            </p>
          </div>
        </div>
      </div>
    </Chapter>
  );
}
