import { useEffect, useState } from "react";
import Chapter from "./Chapter";
import MachineCore from "./MachineCore";
import ProductTerminal from "./ProductTerminal";
import { meeting } from "../../data/product";
import { profiles } from "../../data/profiles";
import { useInView, usePageVisible, useReducedMotion } from "../../lib/hooks";

/**
 * Meeting mode.
 *
 * The section performs the behaviour instead of describing it: on arrival the
 * detector picks up a call, the core slows, the rails go quiet, and the fan
 * ceiling drops to the configured cap. Everything visual gets calmer at once,
 * which is the whole claim.
 *
 * The wording is careful. Detection is by process activity, so Zoom, FaceTime,
 * and Webex count on presence while Discord, Teams, and Slack have to be doing
 * work — a backgrounded chat app is not a call. It lowers the ceiling; it does
 * not promise silence.
 */

const cap = Math.round(meeting.fanCeiling * 100);

const modeCopy: Record<string, string> = {
  presence: "detected when running",
  active: "detected when active",
  learned: "learned from your usage",
};

export default function MeetingMode() {
  const [ref, seen] = useInView<HTMLDivElement>("-25% 0px");
  const visible = usePageVisible();
  const reduced = useReducedMotion();
  const [armed, setArmed] = useState(false);

  // Reduced motion gets the settled state immediately — no half-played beat.
  useEffect(() => {
    if (reduced) {
      setArmed(true);
      return;
    }
    if (!seen || !visible) return;
    const id = window.setTimeout(() => setArmed(true), 620);
    return () => window.clearTimeout(id);
  }, [reduced, seen, visible]);

  return (
    <Chapter
      id="meeting"
      index="05"
      eyebrow="Meeting mode"
      title={
        <>
          Your Mac doesn't need to <span className="serif">join</span> the meeting.
        </>
      }
      lede={
        <p>
          Gcoolers watches for call apps by process activity. When it finds one it holds the fan ceiling at{" "}
          {cap}% and hands the previous behaviour back afterwards. It lowers the ceiling — it can't promise
          silence, and detection is a heuristic, so <code className="code-inline">gcoolers meeting on</code>{" "}
          pins it manually whenever you'd rather be certain.
        </p>
      }
      wide
    >
      <div className={`meet${armed ? " is-armed" : ""}`} ref={ref}>
        <div className="meet-stage">
          <MachineCore className="meet-core" readout={false} fill={0.3} rpm={armed ? 900 : 3200} />

          <div className="meet-detect" role="status" aria-live="polite">
            <p className="meet-detect-label mono">{armed ? "Call detected" : "Listening"}</p>
            <p className="meet-detect-app">{armed ? "Discord" : "—"}</p>
            <span className="meet-detect-wave" aria-hidden="true">
              {Array.from({ length: 18 }, (_, i) => (
                <i key={i} style={{ "--i": i } as React.CSSProperties} />
              ))}
            </span>
          </div>

          <dl className="meet-readout">
            <div>
              <dt className="mono">Fan ceiling</dt>
              <dd className={armed ? "is-down" : undefined}>
                {armed ? `${cap}%` : "100%"}
                <i aria-hidden="true">{armed ? "↓" : ""}</i>
              </dd>
            </div>
            <div>
              <dt className="mono">Governor</dt>
              <dd>{armed ? "capped" : "tracking"}</dd>
            </div>
            <div>
              <dt className="mono">Menu bar</dt>
              <dd>{armed ? "🔇 118°" : "118°"}</dd>
            </div>
            <div>
              <dt className="mono">Restore</dt>
              <dd>after the call</dd>
            </div>
          </dl>
        </div>

        <div className="meet-aside">
          <ProductTerminal
            profile={profiles[0]}
            variant="compact"
            meeting={armed}
            why={armed ? `CPU 118° → ${cap}% · meeting cap` : "cool enough · peak under curve"}
          />

          <div className="meet-apps">
            <p className="mono">Detected apps</p>
            <ul>
              {meeting.apps.map((a) => (
                <li key={a.name}>
                  <b>{a.name}</b>
                  <span>{modeCopy[a.mode]}</span>
                </li>
              ))}
            </ul>
            <p className="meet-apps-note">
              Toggling meeting mode by hand also teaches Gcoolers which apps were open at the time, so the
              list grows into your setup.
            </p>
          </div>
        </div>
      </div>
    </Chapter>
  );
}
