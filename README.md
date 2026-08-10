# Gcoolers

**Apple Silicon thermal governor** — smart fan control, menu bar, Notification Center widget, meeting auto-detect (Zoom / Discord / Teams…), schedules, and learning.

Website: [gcoolers.com](https://gcoolers.com) · Created by Gabe Mills

## Install (Homebrew)

```bash
brew tap Gabe-Mills/gcoolers
brew install gcoolers
gcoolers install    # one-time: sudoers + LaunchAgent + menu bar/widget
gcoolers doctor
```

Then add the widget: Notification Center or desktop → **Edit Widgets** → search **Gcoolers**.

## Install (from source)

```bash
git clone https://github.com/Gabe-Mills/gcoolers.git
cd gcoolers
./scripts/install.sh
```

## Commands

| Command | What it does |
|---|---|
| `gcoolers` | Splash + attach live viewer (daemon keeps running) |
| `gcoolers doctor` | Health check |
| `gcoolers meeting on\|off\|auto` | Quiet fans / auto-detect calls (incl. Discord) |
| `gcoolers schedule on` | Day=`cool` / night=`quiet` |
| `gcoolers export` | Hour history → CSV + HTML in Downloads |
| `gcoolers widget` | How to add the macOS widget |
| `gcoolers notify on\|off` | Debounced thermal alerts |

`gcool` remains a compatibility symlink to `gcoolers`.

## Requirements

- Apple Silicon Mac (macOS 14+)
- Python 3.10+
- Xcode CLT (`swiftc`) for the menu bar app + widget
- Bundled `macmon` (arm64) + `heatwatch-fan` (built from `Tools/heatwatch-fan.c`)

## Privacy

Runs locally. Fan control uses a passwordless sudoers rule **only** for the heatwatch-fan helper after you approve `gcoolers install`.

## License

MIT — see [LICENSE](LICENSE).

`macmon` is from [vladkens/macmon](https://github.com/vladkens/macmon) (vendored arm64 build for convenience).
