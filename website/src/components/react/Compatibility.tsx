import Chapter from "./Chapter";
import { compatibility, minMacOS } from "../../data/product";

/**
 * Compatibility.
 *
 * The fanless row matters more than the rest: a MacBook Air owner should not
 * install this expecting fan control that physically cannot exist on their
 * machine. It gets its own callout rather than a footnote.
 */
export default function Compatibility() {
  return (
    <Chapter
      id="compatibility"
      index="11"
      eyebrow="Requirements"
      title={
        <>
          Apple Silicon, macOS {minMacOS} <span className="serif">or newer</span>.
        </>
      }
      lede={
        <p>
          Homebrew checks most of this for you. The one thing worth reading before you install is what happens
          on a Mac without fans.
        </p>
      }
    >
      <dl className="compat">
        {compatibility.map((c) => (
          <div key={c.label} className="compat-row">
            <dt>
              <b>{c.label}</b>
              <span className="mono">{c.value}</span>
            </dt>
            <dd>{c.note}</dd>
          </div>
        ))}
      </dl>

      <div className="panel fanless">
        <p className="mono">Fanless Macs</p>
        <h3>
          On a MacBook Air there is nothing to spin — and Gcoolers won't pretend <span className="serif">otherwise</span>.
        </h3>
        <p>
          The governor still reads your sensors, still holds a profile, still detects calls, still keeps an
          hour of history, and still alerts you when the machine has been hot for ten minutes. What it cannot
          do is change a fan speed, because there is no fan. If cooler, quieter fans are the reason you're
          here, this is the row to check first.
        </p>
      </div>
    </Chapter>
  );
}
