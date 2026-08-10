import { useEffect, useRef, useState } from "react";

interface Props {
  cmd: string;
  index?: number;
  /** Trailing comment rendered after the command, dimmed. */
  note?: string;
}

/**
 * A copyable command row.
 *
 * The copy button keeps a reserved width so the row never reflows between
 * "Copy" and "Copied", and it stays visible on touch where there is no hover to
 * reveal it. Failures are surfaced rather than silently swallowed — a copy
 * button that does nothing is worse than one that says it didn't work.
 */
export default function CommandLine({ cmd, index, note }: Props) {
  const [state, setState] = useState<"idle" | "done" | "fail">("idle");
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(cmd);
      setState("done");
    } catch {
      setState("fail");
    }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 1800);
  };

  return (
    <div className="cmd">
      {index !== undefined && (
        <span className="cmd-no" aria-hidden="true">
          {String(index).padStart(2, "0")}
        </span>
      )}
      <span className="cmd-prompt" aria-hidden="true">
        $
      </span>
      {/* Each argument is its own nowrap token with real spaces between them, so
          a command that has to wrap breaks at a space rather than mid-argument.
          Left to itself the browser breaks greedily at the first opportunity —
          the hyphen in `gabe-mills` — and prints "brew install gabe-" over
          "mills/gcoolers/gcoolers", which reads like a typo. */}
      <code>
        {cmd.split(" ").flatMap((token, i) => {
          const span = (
            <span className="cmd-token" key={`t${i}`}>
              {token}
            </span>
          );
          return i === 0 ? [span] : [" ", span];
        })}
        {note && <em className="cmd-note"> # {note}</em>}
      </code>
      <button
        type="button"
        className={`cmd-copy${state !== "idle" ? " is-done" : ""}`}
        onClick={copy}
        aria-label={`Copy command: ${cmd}`}
      >
        {state === "done" ? "Copied" : state === "fail" ? "Blocked" : "Copy"}
      </button>
    </div>
  );
}
