/**
 * Port of the live-view paint helpers from bin/gcoolers (viewer_frame).
 * Colors and glyphs match the CLI so the site dashboard reads as the same UI.
 */

export const TEMP_LO = 95;
export const TEMP_HI = 172;
export const VIEW_HIST_SECS = 75;
export const TRACK = "rgb(63, 68, 80)";
export const PARTIALS = "▏▎▍▌▋▊▉█";

const HEAT_STOPS: [number, [number, number, number]][] = [
  [0.0, [56, 189, 248]],
  [0.34, [45, 212, 191]],
  [0.55, [163, 230, 53]],
  [0.72, [250, 204, 21]],
  [0.87, [251, 146, 60]],
  [1.0, [244, 63, 94]],
];

const BRAILLE_L = [0x00, 0x40, 0x44, 0x46, 0x47];
const BRAILLE_R = [0x00, 0x80, 0xa0, 0xb0, 0xb8];

export const PROFILE_ORDER = ["quiet", "balanced", "cool"] as const;
export const PROFILE_LABELS: Record<(typeof PROFILE_ORDER)[number], string> = {
  quiet: "SILENT",
  balanced: "BALANCED",
  cool: "FROST",
};

export function clamp01(t: number) {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

export function tempNorm(f: number) {
  return clamp01((f - TEMP_LO) / (TEMP_HI - TEMP_LO));
}

export function heatRgb(t: number): [number, number, number] {
  t = clamp01(t);
  let prevAt = HEAT_STOPS[0][0];
  let prevRgb = HEAT_STOPS[0][1];
  for (const [at, rgb] of HEAT_STOPS.slice(1)) {
    if (t <= at) {
      const k = (t - prevAt) / Math.max(1e-9, at - prevAt);
      return [
        Math.round(prevRgb[0] + (rgb[0] - prevRgb[0]) * k),
        Math.round(prevRgb[1] + (rgb[1] - prevRgb[1]) * k),
        Math.round(prevRgb[2] + (rgb[2] - prevRgb[2]) * k),
      ];
    }
    prevAt = at;
    prevRgb = rgb;
  }
  return HEAT_STOPS[HEAT_STOPS.length - 1][1];
}

export function heatColor(t: number) {
  const [r, g, b] = heatRgb(t);
  return `rgb(${r}, ${g}, ${b})`;
}

export function thermalBand(f: number): { label: string; glyph: string; tone: string; t: number } {
  const t = tempNorm(f);
  if (f >= 160) return { label: "CRITICAL", glyph: "▲", tone: "crit", t };
  if (f >= 145) return { label: "HOT", glyph: "▲", tone: "hot", t };
  if (f >= 130) return { label: "WARM", glyph: "◆", tone: "warm", t };
  return { label: "COOL", glyph: "◇", tone: "cool", t };
}

export type PaintCell = { ch: string; color: string };

export function gradBar(ratio: number, width = 16): PaintCell[] {
  const filled = clamp01(ratio) * width;
  const cells: PaintCell[] = [];
  for (let i = 0; i < width; i++) {
    const col = heatColor((i + 0.5) / width);
    if (filled >= i + 1) cells.push({ ch: "█", color: col });
    else if (filled > i) {
      const frac = filled - i;
      cells.push({ ch: PARTIALS[Math.min(7, Math.floor(frac * 8))], color: col });
    } else cells.push({ ch: "░", color: TRACK });
  }
  return cells;
}

export function brailleArea(
  values: number[],
  width: number,
  height: number,
  lo: number,
  hi: number,
): PaintCell[][] {
  if (width < 4) return Array.from({ length: height }, () => []);
  if (!values.length) {
    return Array.from({ length: height }, (_, r) =>
      r === height - 1
        ? Array.from({ length: width }, () => ({ ch: "⣀", color: TRACK }))
        : Array.from({ length: width }, () => ({ ch: " ", color: TRACK })),
    );
  }
  const n = values.length;
  const span = Math.max(1e-6, hi - lo);
  const slots = width * 2;
  const levels: number[] = [];
  const norms: number[] = [];
  const top = height * 4;
  for (let i = 0; i < slots; i++) {
    const a = Math.floor((i * n) / slots);
    const b = Math.max(a + 1, Math.floor(((i + 1) * n) / slots));
    const chunk = values.slice(a, b);
    const v = chunk.length ? Math.max(...chunk) : lo;
    const t = clamp01((v - lo) / span);
    norms.push(t);
    levels.push(Math.max(1, Math.min(top, Math.round(t * top))));
  }
  const rows: PaintCell[][] = [];
  for (let r = 0; r < height; r++) {
    const floor = (height - 1 - r) * 4;
    const cells: PaintCell[] = [];
    for (let c = 0; c < width; c++) {
      const li = Math.max(0, Math.min(4, levels[2 * c] - floor));
      const ri = Math.max(0, Math.min(4, levels[2 * c + 1] - floor));
      if (!li && !ri) {
        cells.push({ ch: " ", color: TRACK });
        continue;
      }
      cells.push({
        ch: String.fromCharCode(0x2800 | BRAILLE_L[li] | BRAILLE_R[ri]),
        color: heatColor(Math.max(norms[2 * c], norms[2 * c + 1])),
      });
    }
    rows.push(cells);
  }
  return rows;
}

export function histBounds(samples: number[]) {
  if (!samples.length) return { lo: 100, hi: 140 };
  let lo = Math.min(...samples);
  let hi = Math.max(...samples);
  if (hi - lo < 8) {
    const mid = (lo + hi) / 2;
    lo = mid - 4;
    hi = mid + 4;
  }
  return { lo: lo - 1, hi: hi + 1 };
}

export function coolingWords(fanPct: number, meeting: boolean) {
  if (meeting) return "RELEASED";
  if (fanPct <= 0) return "CALM";
  return "MIXED";
}

export function visibleWidth(s: string) {
  // ASCII + fullwidth-ish: treat each code point as one cell (matches our glyphs).
  return [...s].length;
}
