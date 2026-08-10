import { site } from "../../data/site";
import { installChanges, minMacOS, version } from "../../data/product";
import CommandLine from "./CommandLine";

/** Install — two commands, optional disclosure. */
export default function FinalInstall() {
  return (
    <section className="install" id="install">
      <div className="wrap">
        <div className="install-head">
          <p className="chapter-eyebrow mono">Install</p>
          <h2>
            Two lines. Then <span className="serif">quiet</span>.
          </h2>
          <p>
            Apple Silicon · macOS {minMacOS}+ · MIT. First <code className="code-inline">gcool</code> asks for
            your password once.
          </p>
        </div>

        <div className="panel install-panel install-panel-solo">
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

        <details className="disclose">
          <summary>
            <span>
              What does <code>gcoolers install</code> change?
            </span>
          </summary>
          <div className="disclose-body">
            <ol className="disclose-list">
              {installChanges.map((c) => (
                <li key={c.path}>
                  <code>{c.path}</code>
                  <b>{c.title}</b>
                  <p>{c.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </details>

        <div className="install-links">
          <a className="btn btn-ghost" href="/support">
            Support
          </a>
          <a className="btn btn-quiet" href={site.github} target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          <span className="install-ver mono">v{version}</span>
        </div>
      </div>
    </section>
  );
}
