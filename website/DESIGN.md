# Design System

## Visual Theme

A dark thermal instrument. Frost mist drifts across the top of the field, exhaust haze pools at the
bottom, and a machine core sits behind everything as the product's heartbeat. Motion carries the
story — the page is a governor you scroll through, not a page of feature paragraphs.

Anti-references: purple SaaS gradients, cream/terracotta lifestyle, emoji, blob shapes, card grids of
body copy.

## Color

Dark only. Every accent surface reads from a live core color that the scroll timeline interpolates.

| Role | Token | Value |
|------|-------|-------|
| bg | `--bg` | `oklch(0.085 0.008 240)` |
| bg deep | `--bg-deep` | `oklch(0.055 0.008 250)` |
| surface | `--surface` | `oklch(0.135 0.012 235)` |
| ink | `--ink` | `oklch(0.97 0.008 220)` |
| ink 2 | `--ink-2` | `oklch(0.87 0.012 225)` |
| muted | `--muted` | `oklch(0.745 0.018 230)` |
| dim | `--dim` | `oklch(0.615 0.02 235)` |
| primary (chartreuse) | `--primary` | `oklch(0.82 0.16 118)` |
| accent (ice cyan) | `--accent` | `oklch(0.84 0.115 208)` |
| heat (amber) | `--heat` | `oklch(0.76 0.175 58)` |
| hairline | `--line` | `oklch(1 0 0 / 0.09)` |

### Live core

`--core-l`, `--core-c`, `--core-h`, and `--core-intensity` are set on `<html>` by `ScrollMachine`
and composed into `--core`. Every glow, rail, gauge, and primary button reads `--core`, so the whole
page shifts hue with the active profile:

| Profile | Core hue | Reads as |
|---------|----------|----------|
| Quiet | 158 | green → cyan |
| Balanced | 208 | ice cyan |
| Cool | 62 | amber heat |

Filled primary buttons use near-black ink on the core color for AA contrast.

`--dim` is the floor for text. It carries every mono instrument label (HUD corners, boot register,
scroll cue, module index) and clears 5.6:1 on `--bg`, so hierarchy is built from size and weight
rather than by fading labels below AA.

## Typography

- Display + body: **Inter** (400–800), `-0.045em` tracking on headings
- Instrument labels, readouts, commands: **JetBrains Mono**, uppercase, `0.2em` tracking
- Single accent word: **Instrument Serif** italic (`.serif`)

## Layout

- Max content width 1180px (`.wrap`)
- Homepage is one continuous field: fixed frost background, fixed nav, full-bleed sections
- Hairlines and rhythm instead of cards; the only bordered surfaces are glass panels

## Motion

| Keyframe | Used by |
|----------|---------|
| `frost-drift` | background mist layers |
| `scan-line` | field scan sweep |
| `rail-pulse` | active HUD tick |
| `status-pulse` | meeting-mode indicator, hero status dot |
| `title-fog-reveal` | hero wordmark |
| `core-spin` / `core-breathe` | fan blades, halo |
| `cue-fall` | scroll cue rail |

The scroll sequence is a GSAP ScrollTrigger pin over ~450svh with `scrub`, cross-fading three
profile modules through blur and Z depth. Depth is faked with CSS `perspective`, `blur`, `opacity`,
`rotateX`, and `translate3d` — no Three.js. Modules arrive from behind (tilted back, fogged) and
leave toward the viewer, so no two ever occupy the same plane.

Background depth is carried by three stacked cues rather than brightness: far mist layers are
darker, more blurred, and desaturated; near layers are tighter and keep their hue. Keeping chroma
low is what stops six screen-blended circles from compositing into neon.

## Reduced motion

`prefers-reduced-motion: reduce` skips the boot sequence, disables the pin/scrub timeline, and
renders a static three-panel dashboard with the same readouts. Framer Motion runs under
`MotionConfig reducedMotion="user"`.

## Components

- `.btn` filled (core) → ghost (glass) → quiet (link with a hit area). One filled action per view.
- `.panel` glass surface with a top specular hairline and a clipped core bleed below the edge
- `.cmd` copyable terminal line with a numbered gutter; copy reveals on hover, always on for touch
- `.hud` fixed-corner readouts over the pinned stage — labelling only, never louder than the module
- `.machine-plate` frosted slab between the core and the module type, for readability without a card
- `.rail-tile` interactive support/donate tiles
