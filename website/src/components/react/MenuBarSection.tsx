import Chapter from "./Chapter";
import MenuBarPreview from "./MenuBarPreview";
import { menuBar } from "../../data/product";

/**
 * The menu bar chapter.
 *
 * This is where a visitor decides whether Gcoolers is a real Mac app or a shell
 * script with a website. So the menu is reproduced control for control, and the
 * group list beside it is the actual separator grouping from the Swift source —
 * readout, history, modes, override, force, profiles, alerts.
 */
export default function MenuBarSection() {
  return (
    <Chapter
      id="menubar"
      index="06"
      eyebrow="Menu bar"
      title={
        <>
          Always there. <span className="serif">Never</span> in the way.
        </>
      }
      lede={
        <p>
          One temperature in the menu bar, and the whole governor one click below it. The title carries the
          state on its own: a plain figure while governing, a muted icon on a call, a bolt while boosting, or{" "}
          <code className="code-inline">pause</code> when the fans are back with macOS.
        </p>
      }
    >
      <div className="bar-sec">
        <div className="bar-sec-stage">
          <MenuBarPreview open />
        </div>

        <div className="bar-sec-side">
          <div className="bar-titles">
            <p className="mono">Title states</p>
            <ul>
              {menuBar.titles.map((t) => (
                <li key={t.state}>
                  <b>{t.value}</b>
                  <span>{t.state}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bar-groups">
            <p className="mono">What's in the menu</p>
            <dl>
              {menuBar.groups.map((g) => (
                <div key={g.label}>
                  <dt>{g.label}</dt>
                  <dd>{g.items.join(" · ")}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </Chapter>
  );
}
