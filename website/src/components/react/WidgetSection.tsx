import Chapter from "./Chapter";
import WidgetPreview from "./WidgetPreview";
import { widget } from "../../data/product";

/**
 * The widget chapter.
 *
 * Both families the widget declares, staged on a plausible Notification Center
 * column rather than centred in a card — the panel edge, the blurred desktop
 * behind it, and the stacked widget rhythm are what make it read as macOS. The
 * fields are exactly the ones GcoolersWidgetEntryView renders; nothing extra.
 */
export default function WidgetSection() {
  return (
    <Chapter
      id="widget"
      index="07"
      eyebrow="Notification Center"
      title={
        <>
          Your thermals <span className="serif">at a glance</span>.
        </>
      }
      lede={
        <p>
          A WidgetKit widget ships inside the app. Add it from Notification Center or the desktop —{" "}
          <b>Edit Widgets</b>, then search <b>Gcoolers</b> — and it refreshes about every{" "}
          {widget.refreshSeconds} seconds from the same state file the menu bar reads.
        </p>
      }
    >
      <div className="wg-sec">
        <div className="wg-sec-nc" aria-label="Notification Center preview">
          <div className="wg-sec-nc-head" aria-hidden="true">
            <span>Monday 9 · 9:41</span>
          </div>

          <div className="wg-sec-col">
            <WidgetPreview family="medium" />
            <WidgetPreview family="small" />
            {/* A dimmed neighbour so the column has believable rhythm. It is
                decoration, not a Gcoolers surface. */}
            <div className="wg-ghost" aria-hidden="true">
              <span />
              <span />
            </div>
          </div>
        </div>

        <div className="wg-sec-side">
          <div className="wg-facts">
            <p className="mono">Families</p>
            <p className="wg-facts-big">{widget.families.join(" · ")}</p>
          </div>
          <div className="wg-facts">
            <p className="mono">Shows</p>
            <ul>
              {widget.fields.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
          <p className="wg-facts-note">
            The accent follows the zone the way the widget does: aqua on <b>AUTO</b>, blue while the curve is
            working, warm at <b>MAX</b> or on a call.
          </p>
          <div className="cmd-static">
            <span className="cmd-prompt" aria-hidden="true">
              $
            </span>
            <code>gcoolers widget</code>
          </div>
        </div>
      </div>
    </Chapter>
  );
}
