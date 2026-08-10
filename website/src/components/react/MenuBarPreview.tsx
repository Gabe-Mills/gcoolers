import { profiles, type Profile } from "../../data/profiles";
import { version } from "../../data/product";
import { useOnScreen, usePageVisible, useReducedMotion, useTelemetry } from "../../lib/hooks";

/**
 * The menu bar item and its menu, rebuilt from Sources/GcoolersBar.swift.
 *
 * `refresh()` sets the button title to the peak in °F, prefixed with 🔇 in
 * meeting mode, ⚡ while boosting, or replaced by "pause". `rebuildMenu()` emits
 * the rows below in this order, with separators exactly where the groups break.
 * Nothing here is a control the app does not have.
 */

interface Props {
  profile?: Profile;
  meeting?: boolean;
  /** Renders the dropdown open. Off for the hero, on for the feature section. */
  open?: boolean;
  className?: string;
}

export default function MenuBarPreview({
  profile = profiles[1],
  meeting = false,
  open = false,
  className = "",
}: Props) {
  const [ref, onScreen] = useOnScreen<HTMLDivElement>();
  const visible = usePageVisible();
  const reduced = useReducedMotion();
  const t = useTelemetry(profile, onScreen && visible, reduced);
  const peak = Math.round(t.peakF);

  return (
    <div className={`mb ${className}`.trim()} ref={ref}>
      {/* The strip is decoration: a menu bar with plausible neighbours so the
          Gcoolers item reads as living in macOS rather than floating. */}
      <div className="mb-bar">
        <span className="mb-bar-left" aria-hidden="true">
          <b className="mb-apple" />
          <i>Finder</i>
          <i>File</i>
          <i>Edit</i>
          <i>View</i>
        </span>
        <span className="mb-bar-right">
          <span className={`mb-item${meeting ? " is-meeting" : ""}`}>
            <i className="mb-flake" aria-hidden="true">
              {meeting ? "🔇" : "❄"}
            </i>
            <b>{peak}°</b>
          </span>
          <i className="mb-glyph" aria-hidden="true" />
          <i className="mb-glyph" aria-hidden="true" />
          <span className="mb-clock" aria-hidden="true">
            Mon 9:41
          </span>
        </span>
      </div>

      {open && (
        <div className="mb-menu" role="presentation">
          <p className="mb-menu-head">
            Gcoolers <em>v{version}</em>
          </p>

          <p className="mb-menu-read">
            Peak <b>{t.peakF.toFixed(1)}°F</b> <span>· {t.zone}</span>
          </p>
          <p className="mb-menu-read">
            CPU <b>{t.cpuF.toFixed(1)}°F</b> &nbsp; GPU <b>{t.gpuF.toFixed(1)}°F</b>
          </p>
          <p className="mb-menu-why">
            {t.fanPct === 0
              ? "cool enough · peak under curve"
              : `CPU ${t.cpuF.toFixed(0)}° → ${Math.round(t.fanPct * 100)}%`}
          </p>
          <p className="mb-menu-read is-dim">Profile · {profile.id}</p>

          <hr />
          <MenuRow label="Hour history…" shortcut="H" />
          <MenuRow label="Add Widget…" shortcut="W" />
          <MenuRow label="Export hour…" shortcut="E" />

          <hr />
          <MenuRow label="Meeting mode" shortcut="M" value={meeting ? "On" : "Off"} checked={meeting} />
          <MenuRow label="Meeting · Auto-detect" />
          <MenuRow label="Schedule" shortcut="S" value="Off" />

          <hr />
          <MenuRow label={"Pause cooling"} shortcut="P" />
          <MenuRow label="Boost fans 60s" shortcut="B" />

          <hr />
          <MenuRow label="Force AUTO" />
          <MenuRow label="Force MAX" />
          <MenuRow label="Clear force" />

          <hr />
          <MenuRow label="Profiles" submenu />
          <hr />
          <MenuRow label="Notifications" shortcut="N" value="On" checked />
        </div>
      )}
    </div>
  );
}

function MenuRow({
  label,
  shortcut,
  value,
  checked,
  submenu,
}: {
  label: string;
  shortcut?: string;
  value?: string;
  checked?: boolean;
  submenu?: boolean;
}) {
  return (
    <p className="mb-row">
      <span className="mb-check" aria-hidden="true">
        {checked ? "✓" : ""}
      </span>
      <span className="mb-label">
        {label}
        {value && <em> · {value}</em>}
      </span>
      {submenu && (
        <span className="mb-sub" aria-hidden="true">
          ›
        </span>
      )}
      {shortcut && <span className="mb-key">⌘{shortcut}</span>}
    </p>
  );
}
