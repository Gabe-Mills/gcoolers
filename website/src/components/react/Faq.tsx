import { faq } from "../../data/product";

/**
 * FAQ.
 *
 * Native <details>/<summary>, so it is keyboard and screen-reader correct
 * without any custom accordion state. The warranty question was removed
 * deliberately: the honest, answerable question is whether Gcoolers modifies
 * macOS or firmware, and that is what is asked. No legal guarantees are made
 * about Apple coverage, because this project is in no position to make them.
 */
export default function Faq() {
  return (
    <section className="faq" id="faq" aria-labelledby="faq-title">
      <div className="wrap faq-list">
        <div className="faq-head">
          <p className="chapter-eyebrow mono">13 — Questions</p>
          <h2 id="faq-title">The things people ask before installing.</h2>
        </div>

        {faq.map((item) => (
          <details key={item.q}>
            <summary>{item.q}</summary>
            <p>{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
