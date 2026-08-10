import Chapter from "./Chapter";
import { trust } from "../../data/product";

/**
 * The manifest.
 *
 * Presented as a signed instrumentation panel: numbered rows, a hairline per
 * entry, and the technical detail available without a click. The sudoers rule is
 * stated openly rather than buried — a tool that asks for a password once should
 * say precisely what it did with it, and being specific reads as more
 * professional than being vague.
 */
export default function TrustManifest() {
  return (
    <Chapter
      id="trust"
      index="10"
      eyebrow="Manifest"
      title={
        <>
          Local. <span className="serif">Narrow</span> privilege.
        </>
      }
      lede={<p>One elevated helper. No account. No telemetry.</p>}
    >
      <ol className="manifest">
        {trust.map((t) => (
          <li key={t.key}>
            <span className="manifest-key mono" aria-hidden="true">
              {t.key}
            </span>
            <div className="manifest-body">
              <p className="manifest-label mono">{t.label}</p>
              <p className="manifest-line">{t.line}</p>
              <p className="manifest-detail">{t.body}</p>
            </div>
            <span className="manifest-seal" aria-hidden="true" />
          </li>
        ))}
      </ol>
    </Chapter>
  );
}
