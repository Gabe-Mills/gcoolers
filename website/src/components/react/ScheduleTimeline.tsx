import Chapter from "./Chapter";
import { adaptive, schedule } from "../../data/product";
import { profileById } from "../../lib/telemetry";
import { useInView } from "../../lib/hooks";

/**
 * Schedules and adaptive bias.
 *
 * Two mechanisms that both answer "what changes without me asking", so they
 * share a chapter. The timeline is drawn from the real defaults — day 09:00 to
 * 22:00 on `cool`, night on `quiet` — and the quiet-hours band underneath is a
 * separate mechanism that stays on by default even with the schedule off, which
 * is exactly the sort of thing a timeline explains faster than a paragraph.
 *
 * The bias meter is deliberately not called AI. It is a bounded per-workload
 * offset that moves in small steps when a fan increase actually lowered the
 * peak, and that is what the copy says.
 */

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const pct = (min: number) => (min / 1440) * 100;

const dayStart = toMinutes(schedule.dayStart);
const dayEnd = toMinutes(schedule.dayEnd);
const quietFrom = toMinutes(schedule.quietHours.from);
const quietTo = toMinutes(schedule.quietHours.to);

const ticks = ["00:00", "06:00", "12:00", "18:00", "24:00"];

export default function ScheduleTimeline() {
  const [ref, seen] = useInView<HTMLDivElement>("-20% 0px");
  const day = profileById(schedule.dayProfile as "cool");
  const night = profileById(schedule.nightProfile as "quiet");

  return (
    <Chapter
      id="schedule"
      index="08"
      eyebrow="Schedule · adaptive bias"
      title={
        <>
          Day profile. <span className="serif">Night</span> quiet.
        </>
      }
      lede={
        <p>
          <code className="code-inline">gcoolers schedule on</code> — Cool by day, Quiet by night. Quiet hours
          are on by default.
        </p>
      }
      wide
    >
      <div className={`sched${seen ? " is-seen" : ""}`} ref={ref}>
        <div className="sched-track">
          <div className="sched-scale" aria-hidden="true">
            {ticks.map((t, i) => (
              <span key={t} style={{ left: `${(i / (ticks.length - 1)) * 100}%` }}>
                <i />
                <em>{t}</em>
              </span>
            ))}
          </div>

          <div className="sched-lane">
            <p className="sched-lane-label mono">Schedule</p>
            <div className="sched-bars">
              <span
                className="sched-band is-night"
                style={{ left: 0, width: `${pct(dayStart)}%` }}
                data-label={night.name}
              >
                <b>{night.displayLabel}</b>
              </span>
              <span
                className="sched-band is-day"
                style={{ left: `${pct(dayStart)}%`, width: `${pct(dayEnd - dayStart)}%` }}
                data-label={day.name}
              >
                <b>{day.displayLabel}</b>
              </span>
              <span
                className="sched-band is-night"
                style={{ left: `${pct(dayEnd)}%`, width: `${pct(1440 - dayEnd)}%` }}
                data-label={night.name}
              >
                <b>{night.displayLabel}</b>
              </span>
            </div>
          </div>

          <div className="sched-lane">
            <p className="sched-lane-label mono">Quiet hours</p>
            <div className="sched-bars">
              <span className="sched-band is-quiet" style={{ left: 0, width: `${pct(quietTo)}%` }}>
                <b>+{schedule.quietHoursShift.startsAt}°F later</b>
              </span>
              <span
                className="sched-band is-quiet"
                style={{ left: `${pct(quietFrom)}%`, width: `${pct(1440 - quietFrom)}%` }}
              >
                <b>+{schedule.quietHoursShift.startsAt}°F later</b>
              </span>
            </div>
          </div>

          <p className="sched-note">
            Between {schedule.quietHours.from} and {schedule.quietHours.to} the curve engages{" "}
            {schedule.quietHoursShift.startsAt}°F later, tops out {schedule.quietHoursShift.fullAt}°F higher,
            drops the fan floor by {Math.abs(schedule.quietHoursShift.baseFan) * 100} points, and slows
            sampling to at least {schedule.quietHoursShift.minSample} seconds.
          </p>
        </div>

        <div className="sched-adapt">
          <p className="chapter-eyebrow mono">Adaptive bias</p>
          <h3>It learns from results, not from your feelings about noise.</h3>
          <p>
            After each adjustment the governor compares the peak before and after. If the peak fell by at
            least {adaptive.rewardDeltaF}°F the bias for that workload nudges up; if a fan above half speed
            bought nothing, it nudges down. Steps are{" "}
            {(adaptive.step * 100).toFixed(1)}% and the whole range is clamped.
          </p>

          <div className="bias">
            <span className="bias-scale mono">
              <em>{adaptive.range.min * 100}%</em>
              <em>0</em>
              <em>+{adaptive.range.max * 100}%</em>
            </span>
            <span className="bias-track" aria-hidden="true">
              <i className="bias-zero" />
              <i className="bias-fill" />
            </span>
            <ul className="bias-buckets">
              {adaptive.buckets.map((b) => (
                <li key={b} className="mono">
                  {b}
                </li>
              ))}
            </ul>
            <p className="bias-note">
              One bias per workload shape, so a GPU render and a laptop on battery don't share a lesson.
            </p>
          </div>

          <p className="sched-adapt-foot">
            It also remembers apps. Toggling meeting mode teaches it which app you were on, and a few heavy
            tools ship with a sensible default profile already — Xcode, Final Cut, Blender, Docker, and
            Cursor start on <b>Cool</b>.
          </p>
        </div>
      </div>
    </Chapter>
  );
}
