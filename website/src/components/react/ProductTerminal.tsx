import type { ReactNode } from "react";
import { profiles, type Profile } from "../../data/profiles";
import { version } from "../../data/product";
import {
  brailleArea,
  coolingWords,
  gradBar,
  heatColor,
  histBounds,
  PROFILE_LABELS,
  PROFILE_ORDER,
  tempNorm,
  thermalBand,
  VIEW_HIST_SECS,
  type PaintCell,
} from "../../lib/tui";
import { useOnScreen, usePageVisible, useReducedMotion, useTelemetry } from "../../lib/hooks";

/**
 * Absolute replica of viewer_frame() in bin/gcoolers — same panel edges,
 * meters, profile rail, braille history, WHY line, and key footer.
 */

interface Props {
  profile?: Profile;
  /** "compact" drops HISTORY + keys (meeting aside). */
  variant?: "compact" | "full";
  why?: string;
  meeting?: boolean;
  className?: string;
  /** Shown in the header — generic host, never a personal machine name. */
  host?: string;
}

const BOX = 72;
const METER_W = 16;
const SPARK_W = 48;
const HIST_H = 2;

function Cells({ cells }: { cells: PaintCell[] }) {
  return (
    <>
      {cells.map((c, i) => (
        <span key={i} style={{ color: c.color }}>
          {c.ch}
        </span>
      ))}
    </>
  );
}

function Row({ children }: { children: ReactNode }) {
  return (
    <div className="tui-line">
      <span className="tui-dim">│</span>
      <span className="tui-inner">{children}</span>
      <span className="tui-dim">│</span>
    </div>
  );
}

function Mid({ title, tail }: { title: string; tail?: string }) {
  const fill = Math.max(2, BOX - [...title].length - 4 - (tail ? [...tail].length + 3 : 0));
  return (
    <div className="tui-line">
      <span className="tui-dim">├─ </span>
      <span className="tui-title">{title}</span>
      <span className="tui-dim">
        {" "}
        {"─".repeat(fill)}
        {tail ? ` ${tail} ─┤` : "─┤"}
      </span>
    </div>
  );
}

function ProfileRail({ active }: { active: string }) {
  return (
    <span>
      {PROFILE_ORDER.map((key, i) => {
        const lab = PROFILE_LABELS[key];
        const on = active === key;
        return (
          <span key={key}>
            {i > 0 ? <span className="tui-dim"> · </span> : null}
            {on ? <span className="tui-mode-on">‹{lab}›</span> : <span className="tui-track">{lab}</span>}
          </span>
        );
      })}
      <span className="tui-dim"> · </span>
      <span className="tui-track">MAX</span>
    </span>
  );
}

export default function ProductTerminal({
  profile = profiles[1],
  variant = "full",
  why,
  meeting = false,
  className = "",
  host = "MacBook-Pro",
}: Props) {
  const [ref, onScreen] = useOnScreen<HTMLDivElement>();
  const visible = usePageVisible();
  const reduced = useReducedMotion();
  const t = useTelemetry(profile, onScreen && visible, reduced);

  const cpuBand = thermalBand(t.cpuF);
  const gpuBand = thermalBand(t.gpuF);
  const peakT = tempNorm(t.peakF);
  const bias = t.fanPct > 0 ? 0.02 + t.fanPct * 0.04 : 0;
  const { lo, hi } = histBounds([...t.history, ...t.gpuHistory]);
  const cpuChart = brailleArea(t.history, SPARK_W, HIST_H, lo, hi);
  const gpuChart = brailleArea(t.gpuHistory, SPARK_W, HIST_H, lo, hi);
  const words = coolingWords(t.fanPct, meeting);

  const reason =
    why ??
    (t.fanPct === 0
      ? "cool enough · peak under curve"
      : `CPU ${t.cpuF.toFixed(0)}° → ${Math.round(t.fanPct * 100)}% · learn/mixed +1%`);

  const keys = "B boost · P pause · R profile · Q detach · ? help";
  const headFill = Math.max(2, BOX - 12 - host.length - 18);

  return (
    <div
      className={`tui${className ? ` ${className}` : ""}`}
      ref={ref}
      role="img"
      aria-label={`Gcoolers live dashboard: CPU ${t.cpuF.toFixed(0)}°F, GPU ${t.gpuF.toFixed(0)}°F, fan ${Math.round(t.fanPct * 100)}%`}
    >
      <div className="tui-line">
        <span className="tui-dim">╭─ </span>
        <span className="tui-brand">GCOOLERS</span>
        <span className="tui-dim"> {"─".repeat(headFill)} </span>
        <span className="tui-dim">{host}</span>
        <span className="tui-dim">  v{version}  </span>
        {meeting ? <span className="tui-warn">◼ PAUSED</span> : <span className="tui-ok">● GOVERNING</span>}
        <span className="tui-dim"> ─╮</span>
      </div>

      <Row>
        {"  "}
        <span className="tui-dim">CPU</span>
        {"  "}
        <span style={{ color: heatColor(cpuBand.t), fontWeight: 600 }}>{t.cpuF.toFixed(1).padStart(6)}°F</span>
        {"  "}
        <Cells cells={gradBar(tempNorm(t.cpuF), METER_W)} />
        {"  "}
        <span style={{ color: heatColor(cpuBand.t) }}>
          {cpuBand.glyph} {cpuBand.label}
        </span>
      </Row>

      <Row>
        {"  "}
        <span className="tui-dim">GPU</span>
        {"  "}
        <span style={{ color: heatColor(gpuBand.t), fontWeight: 600 }}>{t.gpuF.toFixed(1).padStart(6)}°F</span>
        {"  "}
        <Cells cells={gradBar(tempNorm(t.gpuF), METER_W)} />
        {"  "}
        <span style={{ color: heatColor(gpuBand.t) }}>
          {gpuBand.glyph} {gpuBand.label}
        </span>
      </Row>

      <Row>
        {"  "}
        <span className="tui-dim">AVG</span> <span className="tui-dim">{`${t.avgF.toFixed(1)}°F`.padStart(7)}</span>
        {"  "}
        <span className="tui-dim">PEAK</span>{" "}
        <span style={{ color: heatColor(peakT) }}>{`${t.peakF.toFixed(1)}°F`.padStart(7)}</span>
        {"  "}
        <span className="tui-dim">NEXT</span> <span>{t.nextSample.toFixed(0)}s</span>
      </Row>

      <Mid title="COOLING" />

      <Row>
        {"  "}
        <span className="tui-dim">FAN</span>
        {"  "}
        <span style={{ color: heatColor(t.fanPct), fontWeight: 700 }}>
          {`${(t.fanPct * 100).toFixed(0)}%`.padStart(5)}
        </span>{" "}
        <Cells cells={gradBar(t.fanPct, METER_W)} />
        {"  "}
        <span className="tui-dim">ice</span> <span style={{ color: heatColor(0.1) }}>+{(bias * 100).toFixed(0)}%</span>
      </Row>

      <Row>
        {"  "}
        <span className="tui-dim">MODE</span> <ProfileRail active={profile.id} />
        {"  "}
        <span className="tui-cyan">{words}</span>
      </Row>

      {variant === "full" && (
        <>
          <Mid title="HISTORY" tail={`~${VIEW_HIST_SECS}s · ${lo.toFixed(0)}–${hi.toFixed(0)}°F`} />
          <Row>
            {" "}
            <span className="tui-dim">CPU</span>{" "}
            <span style={{ color: heatColor(cpuBand.t), fontWeight: 700 }}>{t.cpuF.toFixed(1).padStart(5)}°</span>{" "}
            <Cells cells={cpuChart[0] ?? []} />
          </Row>
          <Row>
            {"           "}
            <Cells cells={cpuChart[1] ?? []} />
          </Row>
          <Row>
            {" "}
            <span className="tui-dim">GPU</span>{" "}
            <span style={{ color: heatColor(gpuBand.t), fontWeight: 700 }}>{t.gpuF.toFixed(1).padStart(5)}°</span>{" "}
            <Cells cells={gpuChart[0] ?? []} />
          </Row>
          <Row>
            {"           "}
            <Cells cells={gpuChart[1] ?? []} />
          </Row>
        </>
      )}

      <Mid title="WHY" />
      <Row>
        {"  "}
        <span className="tui-dim">{reason.slice(0, BOX - 4)}</span>
      </Row>

      {variant === "full" ? (
        <div className="tui-line">
          <span className="tui-dim">
            ╰{"─".repeat(Math.max(2, BOX - keys.length - 4))} {keys} ─╯
          </span>
        </div>
      ) : (
        <div className="tui-line">
          <span className="tui-dim">╰{"─".repeat(BOX)}╯</span>
        </div>
      )}
    </div>
  );
}
