import { profiles, type Profile } from "../../data/profiles";
import { useOnScreen, usePageVisible, useReducedMotion, useTelemetry } from "../../lib/hooks";

/**
 * The Notification Center widget, rebuilt from Sources/GcoolersWidget.swift.
 *
 * Small renders an icon, the peak rounded to a whole degree, and the zone.
 * Medium adds the profile, CPU and GPU rows, and the `why` line, right-aligned
 * in a 180pt column. The accent follows the widget's own rule: warm when the
 * zone contains MAX or meeting mode is on, aqua on AUTO, blue otherwise. The
 * icon is `snowflake`, or `mic.fill` during a call.
 */

interface Props {
  family?: "small" | "medium";
  profile?: Profile;
  meeting?: boolean;
  className?: string;
}

export default function WidgetPreview({
  family = "medium",
  profile = profiles[1],
  meeting = false,
  className = "",
}: Props) {
  const [ref, onScreen] = useOnScreen<HTMLDivElement>();
  const visible = usePageVisible();
  const reduced = useReducedMotion();
  const t = useTelemetry(profile, onScreen && visible, reduced);

  const accent = meeting || t.zone.includes("MAX") ? "warm" : t.zone === "AUTO" ? "aqua" : "blue";
  const why =
    t.fanPct === 0
      ? "cool enough · peak under curve"
      : `CPU ${t.cpuF.toFixed(0)}° → ${Math.round(t.fanPct * 100)}%`;

  return (
    <div className={`wg wg-${family} accent-${accent} ${className}`.trim()} ref={ref}>
      <div className="wg-main">
        <p className="wg-title">
          <i aria-hidden="true">{meeting ? "◉" : "❄"}</i>
          Gcoolers
        </p>
        <p className="wg-peak">
          {Math.round(t.peakF)}
          <em>°{family === "medium" ? "F" : ""}</em>
        </p>
        <p className="wg-sub">{family === "medium" ? `${t.zone} · ${profile.id}` : t.zone}</p>
      </div>

      {family === "medium" && (
        <div className="wg-side">
          <p className="wg-metric">
            <span>CPU</span>
            <b>{Math.round(t.cpuF)}°</b>
          </p>
          <p className="wg-metric">
            <span>GPU</span>
            <b>{Math.round(t.gpuF)}°</b>
          </p>
          <p className="wg-why">{why}</p>
        </div>
      )}
    </div>
  );
}
