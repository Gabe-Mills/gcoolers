import { useRef, useState, type FormEvent } from "react";
import { StarInput } from "./StarRating";
import { isConfigured, submitReview, type SubmitPayload } from "../../lib/reviews";
import { site } from "../../data/site";
import { minMacOS, version } from "../../data/product";

/**
 * New field report.
 *
 * The form checks what it can so the person is not made to wait on a round
 * trip to learn their title is empty — and none of that is trusted. The Worker
 * re-derives every rule from scratch; this is purely a courtesy layer.
 *
 * The success state is careful about what it claims. A submission is queued,
 * not published, and saying anything else would be a lie the moderation queue
 * cannot honour.
 */

const PROFILES = [
  { value: "quiet", label: "Quiet" },
  { value: "balanced", label: "Balanced" },
  { value: "cool", label: "Cool" },
  { value: "mixed", label: "Mixed" },
];

const USE_CASES = [
  { value: "coding", label: "Coding" },
  { value: "gaming", label: "Gaming" },
  { value: "video", label: "Video" },
  { value: "meetings", label: "Meetings" },
  { value: "everyday", label: "Everyday" },
  { value: "other", label: "Other" },
];

const LIMITS = { title: 80, body: 2000, displayName: 40 };

type FieldErrors = Record<string, string>;

export default function ReviewForm() {
  const [rating, setRating] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [macModel, setMacModel] = useState("");
  const [macosVersion, setMacosVersion] = useState("");
  const [gcoolersVersion, setGcoolersVersion] = useState("");
  const [profile, setProfile] = useState("");
  const [useCase, setUseCase] = useState("");
  const [link, setLink] = useState("");
  const [consentPublic, setConsentPublic] = useState(true);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [state, setState] = useState<"idle" | "sending" | "queued" | "error">("idle");
  const [message, setMessage] = useState("");
  const honeypot = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const open = isConfigured();

  function localCheck(): FieldErrors {
    const e: FieldErrors = {};
    if (displayName.trim().length < 2) e.displayName = "Add a display name (2 characters or more).";
    if (!rating) e.rating = "Choose a rating from 1 to 5.";
    if (title.trim().length < 3) e.title = "Add a short title.";
    const bodyLen = body.trim().length;
    if (bodyLen < 40) e.body = `Another ${40 - bodyLen} characters or so — say what actually happened.`;
    return e;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const local = localCheck();
    setErrors(local);
    if (Object.keys(local).length) {
      // Move focus to the first problem so a screen reader announces it.
      const first = Object.keys(local)[0];
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"], #field-${first}`)?.focus();
      return;
    }

    setState("sending");
    setMessage("");

    const payload: SubmitPayload = {
      displayName: displayName.trim(),
      rating,
      title: title.trim(),
      body: body.trim(),
      consentPublic,
      website: honeypot.current?.value || "",
    };
    if (macModel.trim()) payload.macModel = macModel.trim();
    if (macosVersion.trim()) payload.macosVersion = macosVersion.trim();
    if (gcoolersVersion.trim()) payload.gcoolersVersion = gcoolersVersion.trim();
    if (profile) payload.profile = profile;
    if (useCase) payload.useCase = useCase;
    if (link.trim()) payload.link = link.trim();

    const result = await submitReview(payload);
    if (result.ok) {
      setState("queued");
      setMessage(result.message);
      return;
    }
    setState("error");
    setMessage(result.message);
    if (result.fields?.length) {
      const mapped: FieldErrors = {};
      for (const f of result.fields) mapped[f.field] = f.message;
      setErrors(mapped);
    }
  }

  if (!open) {
    return (
      <div className="panel form-closed">
        <p className="mono">Channel closed</p>
        <h2>Submissions are not open yet.</h2>
        <p>
          The review endpoint has not been configured for this build, so there is nowhere to send a report.
          If you have something to say about Gcoolers in the meantime,{" "}
          <a href={site.issues} target="_blank" rel="noopener noreferrer">
            an issue on GitHub
          </a>{" "}
          reaches the same person.
        </p>
      </div>
    );
  }

  if (state === "queued") {
    return (
      <div className="panel form-done" role="status" aria-live="polite">
        <span className="form-done-mark" aria-hidden="true">
          <svg viewBox="0 0 48 48" width="48" height="48">
            <circle className="fd-ring" cx="24" cy="24" r="21" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path className="fd-tick" d="M15 24.5l6.2 6.2L33 19" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <p className="mono">Signal received</p>
        <h2>It's in the queue.</h2>
        {/* Deliberately not "approved" or "published": every report waits for a
            human, and telling someone otherwise would be false. */}
        <p>{message}</p>
        <p className="form-done-note">
          Every report is read before it appears, so it will not show up on the reviews page immediately.
          Nothing else is needed from you.
        </p>
        <div className="btn-row">
          <a className="btn btn-ghost" href="/reviews">
            Back to field reports
          </a>
          <a className="btn btn-quiet" href="/">
            Home
          </a>
        </div>
      </div>
    );
  }

  const err = (k: string) => errors[k];
  const describe = (k: string) => (err(k) ? `field-${k}-error` : undefined);

  return (
    <form className="review-form" onSubmit={onSubmit} noValidate ref={formRef}>
      {state === "error" && message && (
        <p className="form-banner" role="alert">
          {message}
        </p>
      )}

      <fieldset className="rf-block">
        <legend>The report</legend>

        <div className="rf-field">
          <label htmlFor="field-rating" id="label-rating">
            Rating <span aria-hidden="true">*</span>
          </label>
          <StarInput value={rating} onChange={setRating} error={err("rating")} />
        </div>

        <div className="rf-field">
          <label htmlFor="field-displayName">
            Display name <span aria-hidden="true">*</span>
          </label>
          <input
            id="field-displayName"
            name="displayName"
            value={displayName}
            maxLength={LIMITS.displayName}
            required
            autoComplete="nickname"
            aria-invalid={!!err("displayName")}
            aria-describedby={describe("displayName")}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <p className="rf-hint">However you want to be credited. A first name or a handle is fine.</p>
          {err("displayName") && (
            <p className="field-error" id="field-displayName-error">
              {err("displayName")}
            </p>
          )}
        </div>

        <div className="rf-field">
          <label htmlFor="field-title">
            Title <span aria-hidden="true">*</span>
          </label>
          <input
            id="field-title"
            name="title"
            value={title}
            maxLength={LIMITS.title}
            required
            aria-invalid={!!err("title")}
            aria-describedby={describe("title")}
            onChange={(e) => setTitle(e.target.value)}
          />
          <p className="rf-count mono" aria-hidden="true">
            {title.length}/{LIMITS.title}
          </p>
          {err("title") && (
            <p className="field-error" id="field-title-error">
              {err("title")}
            </p>
          )}
        </div>

        <div className="rf-field">
          <label htmlFor="field-body">
            Your report <span aria-hidden="true">*</span>
          </label>
          <textarea
            id="field-body"
            name="body"
            rows={7}
            value={body}
            maxLength={LIMITS.body}
            required
            aria-invalid={!!err("body")}
            aria-describedby={describe("body")}
            onChange={(e) => setBody(e.target.value)}
          />
          <p className="rf-count mono" aria-hidden="true">
            {body.length}/{LIMITS.body}
          </p>
          <p className="rf-hint">
            What changed on your machine? Temperatures, fan behaviour, what you were running. Criticism is
            welcome — a report that says it did nothing for you is as useful as one that says it worked.
          </p>
          {err("body") && (
            <p className="field-error" id="field-body-error">
              {err("body")}
            </p>
          )}
        </div>
      </fieldset>

      <fieldset className="rf-block">
        <legend>Context — all optional</legend>
        <p className="rf-hint rf-block-hint">
          Useful for other readers, and none of it is required. Gcoolers never asks for your address, phone
          number, legal name, or anything that identifies your hardware.
        </p>

        <div className="rf-grid">
          <div className="rf-field">
            <label htmlFor="field-macModel">Mac model</label>
            <input
              id="field-macModel"
              name="macModel"
              value={macModel}
              maxLength={40}
              placeholder="MacBook Pro 14, M3 Pro"
              aria-describedby={describe("macModel")}
              onChange={(e) => setMacModel(e.target.value)}
            />
            {err("macModel") && <p className="field-error" id="field-macModel-error">{err("macModel")}</p>}
          </div>

          <div className="rf-field">
            <label htmlFor="field-macosVersion">macOS</label>
            <input
              id="field-macosVersion"
              name="macosVersion"
              value={macosVersion}
              maxLength={20}
              placeholder={`${minMacOS}.5`}
              onChange={(e) => setMacosVersion(e.target.value)}
            />
          </div>

          <div className="rf-field">
            <label htmlFor="field-gcoolersVersion">Gcoolers version</label>
            <input
              id="field-gcoolersVersion"
              name="gcoolersVersion"
              value={gcoolersVersion}
              maxLength={16}
              placeholder={version}
              onChange={(e) => setGcoolersVersion(e.target.value)}
            />
            <p className="rf-hint">
              <code>gcoolers version</code> prints it.
            </p>
          </div>

          <div className="rf-field">
            <label htmlFor="field-profile">Profile you run</label>
            <select id="field-profile" name="profile" value={profile} onChange={(e) => setProfile(e.target.value)}>
              <option value="">Not saying</option>
              {PROFILES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div className="rf-field">
            <label htmlFor="field-useCase">Mostly used for</label>
            <select id="field-useCase" name="useCase" value={useCase} onChange={(e) => setUseCase(e.target.value)}>
              <option value="">Not saying</option>
              {USE_CASES.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>

          <div className="rf-field">
            <label htmlFor="field-link">GitHub or website</label>
            <input
              id="field-link"
              name="link"
              type="url"
              value={link}
              maxLength={120}
              placeholder="https://github.com/you"
              aria-invalid={!!err("link")}
              aria-describedby={describe("link")}
              onChange={(e) => setLink(e.target.value)}
            />
            {err("link") && <p className="field-error" id="field-link-error">{err("link")}</p>}
          </div>
        </div>

        <div className="rf-check">
          <input
            id="field-consent"
            name="consentPublic"
            type="checkbox"
            checked={consentPublic}
            onChange={(e) => setConsentPublic(e.target.checked)}
          />
          <label htmlFor="field-consent">
            Display my report publicly on this page, under the name above.
            <span>
              Leave this unticked and it still reaches the maintainer, but it will not be published. You can ask
              for it to be removed at any time — see the <a href="/privacy">privacy page</a>.
            </span>
          </label>
        </div>
      </fieldset>

      {/* Honeypot. Hidden from sight and from assistive technology; only an
          automated filler ever puts anything in it. */}
      <div className="rf-hp" aria-hidden="true">
        <label htmlFor="field-website">Website</label>
        <input id="field-website" name="website" type="text" tabIndex={-1} autoComplete="off" ref={honeypot} />
      </div>

      <div className="rf-submit">
        <button type="submit" className="btn btn-primary" disabled={state === "sending"}>
          {state === "sending" ? "Transmitting…" : "Transmit review"}
        </button>
        <p className="rf-submit-note">
          Sends your report to the moderation queue. It is read by a person before it appears on the reviews
          page.
        </p>
      </div>
    </form>
  );
}
