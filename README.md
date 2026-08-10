# Gcoolers

**Apple Silicon thermal governor** — smart fan control, menu bar, Notification Center widget, meeting auto-detect (Zoom / Discord / Teams…), schedules, and learning.

Website: [gcoolers.com](https://gcoolers.com) · Created by Gabe Mills

## Install

```bash
brew install gabe-mills/gcoolers/gcoolers
```

Then run `gcool` once (asks for your Mac password for fan access).

### Alternative (no Homebrew)

```bash
curl -fsSL https://cdn.jsdelivr.net/gh/Gabe-Mills/gcoolers@main/scripts/get.sh | bash
```

### From a checkout

```bash
./scripts/install.sh
```

Then add the widget: Notification Center or desktop → **Edit Widgets** → search **Gcoolers**.

## Commands

| Command | What it does |
|---|---|
| `gcool` / `gcoolers` | Splash + live dashboard (daemon keeps running) |
| `gcoolers doctor` | Health check |
| `gcoolers meeting on\|off\|auto` | Quiet fans / auto-detect calls (incl. Discord) |
| `gcoolers schedule on` | Day=`cool` / night=`quiet` |
| `gcoolers export` | Hour history → CSV + HTML in Downloads |
| `gcoolers menubar` | Rebuild dock / menu bar app |
| `gcoolers widget` | How to add the macOS widget |
| `gcoolers notify on\|off` | Debounced thermal alerts |

`gcool` is a symlink to `gcoolers`.

## Requirements

- Apple Silicon Mac (macOS 14+)
- Python 3.10+
- Xcode CLT (`swiftc`) for the menu bar app + widget
- Bundled `macmon` (arm64) + `heatwatch-fan` (built from `Tools/heatwatch-fan.c`)

## Privacy

Runs locally. Fan control uses a passwordless sudoers rule **only** for a
**root-owned** `heatwatch-fan` at `/Library/Application Support/Gcoolers/bin/heatwatch-fan`
after you approve first setup. Re-run `gcoolers install` after upgrades so sudoers cannot
point at a stale user-writable path.

## License

MIT — see [LICENSE](LICENSE).

`macmon` is from [vladkens/macmon](https://github.com/vladkens/macmon) (vendored arm64 build for convenience).
