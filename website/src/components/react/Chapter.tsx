import type { ReactNode } from "react";
import { useInView } from "../../lib/hooks";

interface Props {
  id: string;
  /** Two-digit chapter marker, printed on the rail. */
  index: string;
  eyebrow: string;
  title: ReactNode;
  lede?: ReactNode;
  children?: ReactNode;
  /** Wide sections drop the centred measure and run full width. */
  wide?: boolean;
  className?: string;
}

/**
 * One chapter of the machine.
 *
 * Every section shares the same opening: a numbered rail that draws itself when
 * the section arrives, a mono eyebrow, and a heading. That repetition is what
 * makes fourteen sections read as one continuous instrument rather than a stack
 * of unrelated panels — the rail is the through-line between them.
 */
export default function Chapter({
  id,
  index,
  eyebrow,
  title,
  lede,
  children,
  wide = false,
  className = "",
}: Props) {
  const [ref, seen] = useInView<HTMLElement>();

  return (
    <section
      className={`chapter${seen ? " is-seen" : ""}${wide ? " is-wide" : ""} ${className}`.trim()}
      id={id}
      ref={ref}
    >
      <div className="wrap">
        <div className="chapter-head">
          <p className="chapter-rail" aria-hidden="true">
            <b>{index}</b>
            <i />
          </p>
          <p className="chapter-eyebrow mono">{eyebrow}</p>
          <h2 className="chapter-title">{title}</h2>
          {lede && <div className="chapter-lede">{lede}</div>}
        </div>
        {children}
      </div>
    </section>
  );
}
