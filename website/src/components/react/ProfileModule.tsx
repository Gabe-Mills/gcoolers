import { forwardRef } from "react";
import type { Profile } from "../../data/profiles";
import ProfileCurve from "./ProfileCurve";

interface Props {
  profile: Profile;
  /** "static" is the stacked mobile / reduced-motion scene, not a fallback. */
  variant?: "stage" | "static";
}

const ProfileModule = forwardRef<HTMLDivElement, Props>(function ProfileModule(
  { profile, variant = "stage" },
  ref,
) {
  const body = (
    <>
      <p className="module-index">
        {profile.index} — {profile.name.toUpperCase()}
      </p>
      <h3 className="module-name">{profile.name}</h3>
      <p className="module-line">{profile.line}</p>
      <div className="module-rail">
        {profile.rail.map((chip) => (
          <span className="module-chip" key={chip}>
            {chip}
          </span>
        ))}
      </div>
      <p className="module-signal">{profile.signal}</p>
    </>
  );

  if (variant === "static") {
    return (
      <div
        className="static-card"
        style={
          {
            "--core-l": profile.core.l,
            "--core-c": profile.core.c,
            "--core-h": profile.core.h,
          } as React.CSSProperties
        }
      >
        <div className="static-copy">
          {body}
          <p className="static-label mono">
            CLI label
            <b>{profile.displayLabel}</b>
          </p>
        </div>

        {/* Each stacked scene carries its own curve, so mobile still gets the
            idea the pinned sequence exists to deliver: same governor, three
            shapes. */}
        <div className="static-curve">
          <ProfileCurve profile={profile} />
          <dl className="static-readouts">
            <Readout label="curve starts" value={`${profile.readouts.startsAt}°F`} />
            <Readout label="fan full at" value={`${profile.readouts.fullAt}°F`} />
            <Readout label="fan floor" value={`${Math.round(profile.readouts.baseFan * 100)}%`} />
            <Readout label="sample every" value={`${profile.readouts.sample}s`} />
          </dl>
        </div>
      </div>
    );
  }

  return (
    <div className="module" ref={ref} data-profile={profile.id}>
      {body}
    </div>
  );
});

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="hud-meter">
      <dt className="mono">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export default ProfileModule;
