import { profiles, type Profile } from "../../data/profiles";
import { liveKeys, version } from "../../data/product";
import { meterCells, tempRatio, waveChar, waveTone, type Telemetry } from "../../lib/telemetry";
import { useOnScreen, usePageVisible, useReducedMotion, useTelemetry } from "../../lib/hooks";

/**
 * The live view, rebuilt row for row.
 *
 * attach_viewer() in bin/gcoolers prints THERMALS, COOLING, THERMAL HISTORY,
 * the next-sample countdown, the `why` line, and a key legend. Same sections,
 * same order, same block characters — the bars use the real ramp and the
 * sparklines use the real wave glyphs, so this is the program's own output
 * rather than a stylised impression of a terminal.
 */

interface Props {
  profile?: Profile;
  /** "compact" drops history + the key legend for the hero composition. */
  variant?: "compact" | "full";
  /** The `why` string the governor would be printing. */
  why?: string;
  meeting?: boolean;
  className?: string;
}

function Meter({ ratio, tone, width = 14 }: { ratio: number; tone: string; width?: number }) {
  const { filled, empty } = meterCells(ratio, width);
  return (
    <span className={`tm-meter tone-${tone}`} aria-hidden="true">
      <span className="tm-meter-on">{"█".repeat(filled)}</span>
      <span className="tm-meter-off">{"░".repeat(empty)}</span>
    </span>
  );
}

function Spark({ values, lo, hi, width = 30 }: { values: number[]; lo: number; hi: number; width?: number }) {
  const span = Math.max(1e-6, hi - lo);
  const n = values.length;
  const cells = Array.from({ length: width }, (_, i) => {
    const a = Math.floor((i * n) / width);
    const b = Math.max(a + 1, Math.floor(((i + 1) * n) / width));
    const v = Math.max(...values.slice(a, b), lo);
    const t = (v - lo) / span;
    return { ch: waveChar(t), tone: waveTone(t) };
  });
  return (
    <span className="tm-spark" aria-hidden="true">
      {cells.map((c, i) => (
        <i key={i} className={`tone-${c.tone}`}>
          {c.ch}
        </i>
      ))}
    </span>
  );
}

function TempRow({ label, value, band }: { label: string; value: number; band: Telemetry["band"] }) {
  return (
    <div className="tm-row">
      <span className="tm-key">{label}</span>
      <span className={`tm-val tone-${band.tone}`}>{value.toFixed(1)}°F</span>
      <Meter ratio={tempRatio(value)} tone={band.tone} />
      <span className={`tm-band tone-${band.tone}`}>
        <i aria-hidden="true">{band.glyph}</i> {band.label}
      </span>
    </div>
  );
}

export default function ProductTerminal({
  profile = profiles[1],
  variant = "full",
  why,
  meeting = false,
  className = "",
}: Props) {
  const [ref, onScreen] = useOnScreen<HTMLDivElement>();
  const visible = usePageVisible();
  const reduced = useReducedMotion();
  const t = useTelemetry(profile, onScreen && visible, reduced);

  const cpuBand = { ...t.band };
  const fanTone = t.fanPct > 0.85 ? "crit" : t.fanPct > 0.55 ? "hot" : "cool";
  const lo = Math.min(...t.history) - 2;
  const hi = Math.max(...t.history) + 2;

  const reason =
    why ??
    (t.fanPct === 0
      ? "cool enough · peak under curve"
      : `CPU ${t.cpuF.toFixed(0)}° → ${Math.round(t.fanPct * 100)}% · learn/mixed +1%`);

  return (
    <div className={`term ${className}`.trim()} ref={ref}>
      <div className="term-chrome">
        <span className="term-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="term-path">gcoolers — live view</span>
      </div>

      <div className="term-body">
        <div className="term-head">
          <span className="term-brand">
            GCoolers <em>v{version}</em>
          </span>
          <span className={`term-daemon${meeting ? " is-meeting" : ""}`}>
            <i aria-hidden="true" />
            {meeting ? "MEETING CAP" : "DAEMON ACTIVE"}
          </span>
        </div>

        <hr className="term-rule" />

        <p className="term-section">Thermals</p>
        <TempRow label="CPU" value={t.cpuF} band={cpuBand} />
        <TempRow label="GPU" value={t.gpuF} band={cpuBand} />
        <div className="tm-row is-quiet">
          <span className="tm-key">AVG</span>
          <span className="tm-val">{t.avgF.toFixed(1)}°F</span>
        </div>
        <div className="tm-row">
          <span className="tm-key">PEAK</span>
          <span className={`tm-val tone-${t.band.tone}`}>{t.peakF.toFixed(1)}°F</span>
          <span className="tm-meter" aria-hidden="true" />
          <span className={`tm-band tone-${t.band.tone}`}>
            <i aria-hidden="true">{t.band.glyph}</i> {t.band.label}
          </span>
        </div>

        <p className="term-section">Cooling</p>
        <div className="tm-row">
          <span className="tm-key">Fan</span>
          <Meter ratio={t.fanPct} tone={fanTone} />
          <span className={`tm-val tone-${fanTone}`}>{Math.round(t.fanPct * 100)}%</span>
        </div>
        <div className="tm-row">
          <span className="tm-key">Profile</span>
          <span className="tm-rail" aria-hidden="true">
            {profiles.map((p) => (
              <b key={p.id} className={p.id === profile.id ? "is-on" : undefined}>
                [ {p.displayLabel} ]
              </b>
            ))}
            <b>[ MAX ]</b>
          </span>
        </div>
        <div className="tm-row">
          <span className="tm-key">Zone</span>
          <span className="tm-val">{t.zone}</span>
        </div>

        {variant === "full" && (
          <>
            <p className="term-section">Thermal history</p>
            <div className="tm-row">
              <span className="tm-key">CPU</span>
              <Spark values={t.history} lo={lo} hi={hi} />
              <span className={`tm-val tone-${t.band.tone}`}>{t.cpuF.toFixed(1)}°F</span>
            </div>
            <div className="tm-row">
              <span className="tm-key">GPU</span>
              <Spark values={t.gpuHistory} lo={lo} hi={hi} />
              <span className="tm-val">{t.gpuF.toFixed(1)}°F</span>
            </div>
          </>
        )}

        <p className="term-note">Next sample in {t.nextSample}s</p>
        <p className="term-why">{reason}</p>

        {variant === "full" && (
          <>
            <hr className="term-rule" />
            <p className="term-keys">
              {liveKeys.map((k) => (
                <span key={k.key}>
                  <b>[{k.key}]</b> {k.what}
                </span>
              ))}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
