import { site } from "../../data/site";
import { doctorChecks, installChanges, minMacOS, version } from "../../data/product";
import CommandLine from "./CommandLine";
import { useInView } from "../../lib/hooks";

/**
 * Install.
 *
 * The commands stay visually dominant — that headline earns its place — but two
 * things sit next to them: the doctor output, so the first thing a new user
 * reaches for is the diagnostic rather than a support email, and a full
 * disclosure of what `gcoolers install` writes. The disclosure is a native
 * <details>, closed by default so it never competes with the commands.
 *
 * The flow is two commands, not the four this page used to print. `brew install
 * <tap>/<formula>` taps and installs together, and the first run of `gcool`
 * calls install_gcool() itself.
 */
export default function FinalInstall() {
  const [ref, seen] = useInView<HTMLElement>("-15% 0px");

  return (
    <section className="install" id="install" ref={ref}>
      <div className="wrap">
        <div className="install-head">
          <p className="chapter-eyebrow mono">12 — Install</p>
          <h2>
            Two lines. Then <span className="serif">quiet</span>.
          </h2>
          <p>
            Apple Silicon · macOS {minMacOS}+ · MIT. First <code className="code-inline">gcool</code> asks for
            your password once.
          </p>
        </div>

        <div className="install-grid">
          <div className="panel install-panel">
            <div className="install-panel-head">
              <span className="install-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span className="mono">zsh — {site.domain}</span>
            </div>

            <div className="install-body">
              {site.homebrew.map((cmd, i) => (
                <CommandLine key={cmd} cmd={cmd} index={i + 1} />
              ))}
            </div>
          </div>

          {/* Doctor, right beside the install, because it is the answer to
              "did that work?" and to most support emails. */}
          <div className={`panel doctor${seen ? " is-seen" : ""}`}>
            <div className="doctor-head">
              <span className="mono">Then check it</span>
              <code>gcoolers doctor</code>
            </div>
            <ul className="doctor-list">
              {doctorChecks.map((c, i) => (
                <li key={c.name} style={{ "--i": i } as React.CSSProperties}>
                  <span className="doctor-mark" aria-hidden="true">
                    ✓
                  </span>
                  <b>{c.name}</b>
                  <em>{c.detail}</em>
                </li>
              ))}
            </ul>
            <p className="doctor-foot">{doctorChecks.length} checks. Failures print the fix.</p>
          </div>
        </div>

        <details className="disclose">
          <summary>
            <span>
              What does <code>gcoolers install</code> change?
            </span>
          </summary>
          <div className="disclose-body">
            <p className="disclose-lede">{installChanges.length} paths. All reversible.</p>
            <ol className="disclose-list">
              {installChanges.map((c) => (
                <li key={c.path}>
                  <code>{c.path}</code>
                  <b>{c.title}</b>
                  <p>{c.body}</p>
                </li>
              ))}
            </ol>
            <p className="disclose-foot">
              Remove: unload LaunchAgent · brew uninstall · delete sudoers + both Gcoolers Application Support
              folders · delete ~/Applications/Gcoolers.app. No-Homebrew install:{" "}
              <a href={site.readme} target="_blank" rel="noopener noreferrer">
                README
              </a>
              .
            </p>
          </div>
        </details>

        <div className="install-links">
          <a className="btn btn-ghost" href={site.homebrewTap} target="_blank" rel="noopener noreferrer">
            Homebrew tap
          </a>
          <a className="btn btn-quiet" href={site.readme} target="_blank" rel="noopener noreferrer">
            Read the docs
          </a>
          <a className="btn btn-quiet" href="/support">
            Get help
          </a>
          <span className="install-ver mono">v{version}</span>
        </div>
      </div>
    </section>
  );
}
