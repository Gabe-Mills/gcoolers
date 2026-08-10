import { useState } from "react";
import Chapter from "./Chapter";
import ProductTerminal from "./ProductTerminal";
import { profiles } from "../../data/profiles";
import { commands } from "../../data/product";

/**
 * The live view, at full size, with the profile switchable.
 *
 * Switching the profile here re-runs the same curve the daemon runs, so the fan
 * percentage next to a temperature moves the way it would on the machine. That
 * is the point of the control: it is not a tab, it is the governor being asked
 * to hold a different strategy.
 */
export default function LiveView() {
  const [idx, setIdx] = useState(1);
  const profile = profiles[idx];

  return (
    <Chapter
      id="live"
      index="03"
      eyebrow="Live view"
      title={
        <>
          Type <code className="code-inline">gcoolers</code>.
        </>
      }
      lede={
        <p>
          Attaches a viewer. <b>Q</b> detaches — the daemon keeps running.
        </p>
      }
    >
      <div className="live">
        <div className="live-term">
          <ProductTerminal profile={profile} variant="full" />
          <p className="live-caption mono">
            Demonstration · synthetic load, real curve — {profile.readouts.startsAt}°F start,{" "}
            {profile.readouts.fullAt}°F full, {Math.round(profile.readouts.baseFan * 100)}% floor
          </p>
        </div>

        <div className="live-side">
          <div className="live-switch" role="group" aria-label="Thermal profile">
            <p className="mono">Hold profile</p>
            {profiles.map((p, i) => (
              <button
                key={p.id}
                type="button"
                className={`live-opt${i === idx ? " is-on" : ""}`}
                aria-pressed={i === idx}
                onClick={() => setIdx(i)}
                style={
                  {
                    "--core-l": p.core.l,
                    "--core-c": p.core.c,
                    "--core-h": p.core.h,
                  } as React.CSSProperties
                }
              >
                <b>{p.name}</b>
                <em className="mono">{p.displayLabel}</em>
                <span className="mono">
                  {p.readouts.startsAt}° → {p.readouts.fullAt}°F
                </span>
              </button>
            ))}
          </div>

          <div className="live-cmds">
            <p className="mono">Commands</p>
            <dl>
              {commands.slice(0, 7).map((c) => (
                <div key={c.cmd}>
                  <dt>
                    <code>{c.cmd}</code>
                  </dt>
                  <dd>{c.what}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </Chapter>
  );
}
