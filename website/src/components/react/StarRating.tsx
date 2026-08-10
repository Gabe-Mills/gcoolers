import { useId, useState } from "react";

/**
 * Star controls.
 *
 * The interactive one is a real radiogroup, not a row of clickable divs: arrow
 * keys move between values, Home and End jump to the ends, and only the checked
 * radio is in the tab order, which is what a keyboard user expects from a
 * single-choice control. The visual star is decorative and hidden from the
 * accessibility tree; the label is the accessible name.
 */

const STAR_PATH =
  "M12 2.6l2.72 5.85 6.28.84-4.6 4.35 1.17 6.36L12 16.9l-5.57 3.1 1.17-6.36-4.6-4.35 6.28-.84z";

export function Star({ filled, half = false }: { filled: boolean; half?: boolean }) {
  const gradId = useId();
  return (
    <svg className={`star${filled ? " is-on" : ""}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {half && (
        <defs>
          <linearGradient id={gradId}>
            <stop offset="50%" stopColor="currentColor" />
            <stop offset="50%" stopColor="transparent" />
          </linearGradient>
        </defs>
      )}
      <path d={STAR_PATH} fill={half ? `url(#${gradId})` : filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

/** Read-only display, e.g. on a review card. */
export function StarDisplay({ rating, label }: { rating: number; label?: string }) {
  return (
    <span className="stars" role="img" aria-label={label ?? `${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} filled={n <= rating} />
      ))}
    </span>
  );
}

const WORDS: Record<number, string> = {
  1: "Did not work for me",
  2: "Some problems",
  3: "Mixed",
  4: "Good",
  5: "Excellent",
};

export function StarInput({
  value,
  onChange,
  name = "rating",
  error,
}: {
  value: number;
  onChange: (n: number) => void;
  name?: string;
  error?: string;
}) {
  const groupId = useId();
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value;

  return (
    <div className="star-input">
      <div
        role="radiogroup"
        aria-labelledby={`${groupId}-label`}
        aria-describedby={error ? `${groupId}-error` : `${groupId}-hint`}
        className="star-row"
        onMouseLeave={() => setHover(null)}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className={`star-choice${n <= shown ? " is-on" : ""}`} onMouseEnter={() => setHover(n)}>
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              // Only the selected radio is tabbable; arrows move within the
              // group. This is the native behaviour of a radio group and the
              // reason not to rebuild it out of buttons.
              onKeyDown={(e) => {
                if (e.key === "Home") {
                  e.preventDefault();
                  onChange(1);
                } else if (e.key === "End") {
                  e.preventDefault();
                  onChange(5);
                }
              }}
            />
            <Star filled={n <= shown} />
            <span className="sr-only">
              {n} star{n === 1 ? "" : "s"} — {WORDS[n]}
            </span>
          </label>
        ))}
      </div>
      <p className="star-word mono" id={`${groupId}-hint`} aria-live="polite">
        {value ? WORDS[value] : "Select a rating"}
      </p>
      {error && (
        <p className="field-error" id={`${groupId}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}
