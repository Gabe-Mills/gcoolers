import { site } from "../../data/site";
import { useInView } from "../../lib/hooks";

/**
 * Closing beat.
 *
 * Open source gets a real moment rather than a link in the footer. The four
 * facts are all verifiable in the repository — no star counts, no contributor
 * numbers, nothing fetched at runtime that could be wrong or slow.
 */

const facts = [
  { key: "License", value: "MIT" },
  { key: "Language", value: "Python · Swift · C" },
  { key: "Runs", value: "Locally" },
  { key: "Version", value: `v${site.version}` },
] as const;

export default function OpenSource() {
  const [ref, seen] = useInView<HTMLElement>("-20% 0px");

  return (
    <section className={`os${seen ? " is-seen" : ""}`} id="source" ref={ref}>
      <div className="wrap os-inner">
        <p className="chapter-eyebrow mono">14 — Open source</p>
        <h2>
          Every line of it is <span className="serif">readable</span>.
        </h2>
        <p className="os-lede">
          The governor, the SMC helper, the menu bar app, and the widget are in one public repository. If you
          want to know exactly what it does to your Mac, you don't have to take this page's word for it.
        </p>

        <dl className="os-facts">
          {facts.map((f) => (
            <div key={f.key}>
              <dt className="mono">{f.key}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>

        <div className="btn-row os-ctas">
          <a className="btn btn-primary" href={site.github} target="_blank" rel="noopener noreferrer">
            View source
          </a>
          <a className="btn btn-ghost" href={site.homebrewTap} target="_blank" rel="noopener noreferrer">
            Homebrew tap
          </a>
          <a className="btn btn-quiet" href={site.license} target="_blank" rel="noopener noreferrer">
            MIT licence
          </a>
        </div>
      </div>
    </section>
  );
}
