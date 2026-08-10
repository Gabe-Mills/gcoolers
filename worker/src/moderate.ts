/**
 * Moderation.
 *
 * Three levels, in order of severity:
 *
 *   L1  ordinary profanity  -> censored to asterisks, review still publishes
 *   L2  serious abuse       -> FLAGGED, held for a human, neutral response
 *   L3  attack or bot spam  -> hard reject with a generic error
 *
 * Two things drive every design decision here.
 *
 * First, false positives are worse than misses. "Scunthorpe" and "class" and
 * "assess" must survive untouched, so ordinary matching is token-exact rather
 * than substring. The separator pass that catches `f.u.c.k` additionally
 * requires the match to begin and end on a real word boundary in the original
 * text, which is what stops "mass hole" from being read as an insult.
 *
 * Second, we never keep what we censored. Only the censored string is returned
 * for storage; the caller is expected to discard the raw input. Flags are
 * category codes, not excerpts, so an operator sees "hate_speech" rather than
 * a stored copy of the abuse.
 */

export type Severity = "clean" | "censored" | "flagged" | "rejected";

export interface ModerationResult {
  severity: Severity;
  /** Text safe to store and display. Never contains the uncensored original. */
  text: string;
  /** Category codes only — never excerpts of the offending content. */
  flags: string[];
  /** True when L1 replaced anything. */
  censored: boolean;
}

/* ------------------------------------------------------------------ *
 * Normalisation
 * ------------------------------------------------------------------ */

/** Zero-width and directionality characters used to split words invisibly. */
const INVISIBLE = /[­᠎​-‏‪-‮⁠-⁤⁪-⁯﻿]/g;

/** Confusables that turn up in evasion far more than in real writing. */
const LEET: Record<string, string> = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "9": "g",
  "@": "a", $: "s", "!": "i", "|": "i", "+": "t", "€": "e", "£": "l",
  а: "a", е: "e", о: "o", р: "p", с: "c", у: "y", х: "x", і: "i", ѕ: "s",
  "α": "a", "ο": "o", "ρ": "p", "ε": "e", "ι": "i", "κ": "k", "ν": "v",
};

/**
 * Fold a single character toward its plain-ASCII letter identity.
 * Returns "" for characters that carry no letter meaning.
 */
function foldChar(ch: string): string {
  const lower = ch.toLowerCase();
  if (LEET[lower] !== undefined) return LEET[lower];
  // Strip accents: é -> e, ü -> u.
  const stripped = lower.normalize("NFD").replace(/\p{M}+/gu, "");
  if (/^[a-z]$/.test(stripped)) return stripped;
  return "";
}

interface Folded {
  /** Letters only, lowercase, de-leeted. */
  letters: string;
  /** letters[i] came from original index map[i]. */
  map: number[];
  /** True when original[map[i]] starts a word (previous original char is not a letter). */
  startsWord: boolean[];
  /** True when original[map[i]] ends a word. */
  endsWord: boolean[];
}

function fold(original: string): Folded {
  const letters: string[] = [];
  const map: number[] = [];
  const isLetterAt: boolean[] = [];

  for (let i = 0; i < original.length; i++) {
    const f = foldChar(original[i]);
    isLetterAt[i] = f !== "";
    if (f) {
      // A leet char can fold to one letter only; keep the mapping 1:1.
      letters.push(f[0]);
      map.push(i);
    }
  }

  const startsWord: boolean[] = [];
  const endsWord: boolean[] = [];
  for (let k = 0; k < map.length; k++) {
    const orig = map[k];
    startsWord[k] = orig === 0 || !isLetterAt[orig - 1];
    endsWord[k] = orig === original.length - 1 || !isLetterAt[orig + 1];
  }

  return { letters: letters.join(""), map, startsWord, endsWord };
}

/** Collapse runs of 3+ identical letters: "fuuuuck" -> "fuuck" -> matched as "fuck". */
function deRepeat(word: string): string {
  return word.replace(/(.)\1{1,}/g, "$1");
}

/* ------------------------------------------------------------------ *
 * Word lists
 * ------------------------------------------------------------------ */

/**
 * Ordinary swearing. Allowed through, censored in the public copy.
 * Deliberately short: this is a thermal utility's review page, not a filter
 * product, and every extra entry is another chance to mangle a real sentence.
 */
const ORDINARY = [
  "fuck", "shit", "bitch", "bastard", "asshole", "arsehole", "dickhead",
  "wanker", "bollocks", "prick", "twat", "cunt", "damn", "goddamn",
  "crap", "piss", "slut", "whore", "douche", "jackass", "dumbass",
  "ass", "arse", "dick", "cock", "bullshit", "motherfucker", "fucker",
];

/**
 * Words that legitimately contain a shorter entry above. Token-exact matching
 * already protects these, but they are listed so the intent is explicit and so
 * the separator pass can consult them.
 */
const ALLOWLIST = new Set([
  "class", "classes", "classic", "pass", "passed", "passes", "password",
  "bass", "grass", "brass", "glass", "mass", "massive", "assess", "assessment",
  "asset", "assets", "assist", "assign", "assume", "assumption", "associate",
  "assembly", "assassin", "embassy", "compass", "canvas", "harass",
  "cockpit", "cocktail", "peacock", "shiitake", "analysis", "analyst",
  "analytics", "therapist", "scunthorpe", "penistone", "sussex", "essex",
  "middlesex", "titan", "titanium", "matsushita", "dickens", "hancock",
  "assumed", "assuming", "assurance", "assured", "bypass", "surpass",
]);

/**
 * Serious categories. These do not publish — they go to a human.
 *
 * The hate-speech terms are base64 so that this source file is not itself a
 * readable slur list; decoding happens once at module load. Everything else is
 * expressed as a pattern, because threats and doxxing are shapes of sentence
 * rather than individual words.
 */
const HATE_ENCODED = [
  "bmlnZ2Vy", "bmlnZ2E=", "ZmFnZ290", "ZmFnZ3k=", "a2lrZQ==", "c3BpYw==",
  "Y2hpbms=", "dHJhbm55", "cmV0YXJk", "cGFraQ==", "Z29vaw==", "d2V0YmFjaw==",
  "Y29vbg==", "YmVhbmVy", "dG93ZWxoZWFk", "cmFnaGVhZA==",
];

const HATE = HATE_ENCODED.map((b64) => atob(b64));

const THREAT_PATTERNS: Array<[RegExp, string]> = [
  [/\b(?:i(?:'| a)?m going to|i will|imma|gonna)\s+(?:kill|murder|stab|shoot|hurt|beat)\s+(?:you|him|her|them|u)\b/i, "threat"],
  [/\b(?:kill|hang|shoot)\s+your\s?self\b/i, "self_harm_encouragement"],
  [/\bkys\b/i, "self_harm_encouragement"],
  [/\b(?:i(?:'| a)?ll|i will)\s+find\s+(?:you|u)\b.{0,40}\b(?:hurt|kill|end)\b/i, "threat"],
  [/\byou\s+(?:should|deserve to)\s+die\b/i, "threat"],
];

const DOXX_PATTERNS: Array<[RegExp, string]> = [
  // Street address, phone number, and government identifier shapes. The site
  // never asks for these, so their presence in free text is a red flag either
  // way — someone posting their own or someone else's.
  [/\b\d{1,5}\s+[A-Za-z][A-Za-z.\- ]{2,30}\s+(?:street|st|road|rd|avenue|ave|lane|ln|drive|dr|boulevard|blvd|court|ct)\b/i, "possible_address"],
  [/\b(?:\+?\d{1,3}[ .-]?)?\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4}\b/, "possible_phone"],
  [/\b\d{3}-\d{2}-\d{4}\b/, "possible_government_id"],
];

const EXPLICIT_PATTERNS: Array<[RegExp, string]> = [
  [/\b(?:porn|pornhub|xxx|onlyfans|escort service|camgirl)\b/i, "explicit"],
  [/\b(?:rape|raping|molest)\b/i, "explicit"],
];

/* ------------------------------------------------------------------ *
 * Level 3 — hard reject
 * ------------------------------------------------------------------ */

const ATTACK_PATTERNS: Array<[RegExp, string]> = [
  [/<\s*script\b/i, "xss_script_tag"],
  [/<\s*\/?\s*(?:iframe|object|embed|svg|img|link|meta|style|form|input|base)\b/i, "xss_html_tag"],
  [/\bon(?:error|load|click|mouseover|focus|animationstart|toggle)\s*=/i, "xss_event_handler"],
  [/javascript\s*:/i, "xss_js_uri"],
  [/data\s*:\s*text\/html/i, "xss_data_uri"],
  [/\bdocument\s*\.\s*(?:cookie|domain|write)\b/i, "xss_dom_access"],
  [/\bwindow\s*\.\s*location\b/i, "xss_redirect"],
  [/\beval\s*\(|\bnew\s+Function\s*\(/i, "xss_eval"],
  [/&#x?[0-9a-f]{2,6};?\s*(?:script|onerror)/i, "xss_entity_encoded"],
  [/\b(?:union\s+select|drop\s+table|insert\s+into|--\s*$|\bor\s+1\s*=\s*1\b)/i, "sqli_shape"],
  [/\{\{.*\}\}|\$\{.*\}/, "template_injection"],
];

const SPAM_PATTERNS: Array<[RegExp, string]> = [
  [/\b(?:viagra|cialis|casino|crypto\s?giveaway|forex|binary options|seo services|backlinks?|buy followers)\b/i, "spam_keyword"],
  [/\b(?:t\.me|bit\.ly|tinyurl|goo\.gl|cutt\.ly|is\.gd|shorturl)\b/i, "spam_shortlink"],
  [/\b(?:whatsapp|telegram)\s*(?:me|:|\+)/i, "spam_contact"],
];

/**
 * Link flooding, counted rather than matched. The obvious regex —
 * `(?:https?:\/\/[^\s]+){4,}` — only fires on four URLs jammed together with no
 * whitespace, which is not how anyone writes, so real link spam walked straight
 * past it.
 */
const LINK_FLOOD_THRESHOLD = 4;

function linkCount(text: string): number {
  return (text.match(/https?:\/\//gi) || []).length;
}

/** Hosts that are never legitimate in a review of a Mac utility. */
const URL_DENY = /\b(?:\.ru|\.tk|\.top|\.xyz|\.cn|\.buzz|\.click|\.loan|\.work)\b/i;

/* ------------------------------------------------------------------ *
 * Level 1 — censoring
 * ------------------------------------------------------------------ */

/** Suffixes stripped when testing a token, so "fucking" matches "fuck". */
const SUFFIXES = ["ings", "ing", "ers", "er", "ed", "es", "s", "y", "ies"];

function tokenHits(token: string): boolean {
  const t = deRepeat(token);
  if (ALLOWLIST.has(token) || ALLOWLIST.has(t)) return false;
  for (const candidate of [token, t]) {
    if (ORDINARY.includes(candidate)) return true;
    for (const suf of SUFFIXES) {
      if (candidate.length > suf.length + 2 && candidate.endsWith(suf)) {
        const stem = candidate.slice(0, -suf.length);
        if (ORDINARY.includes(stem) && !ALLOWLIST.has(stem)) return true;
      }
    }
  }
  return false;
}

function starsFor(original: string, from: number, to: number): string {
  // Replace letters with asterisks and leave punctuation, so the shape and
  // rough length of the sentence survive: "f***ing" not "*******".
  let out = "";
  for (let i = from; i <= to; i++) {
    out += foldChar(original[i]) ? "*" : original[i];
  }
  return out;
}

/**
 * Censor ordinary profanity.
 *
 * Pass A walks real tokens, which is exact and cannot produce a Scunthorpe.
 * Pass B searches the letters-only projection so `f.u.c.k` and `f u c k` are
 * caught, but only accepts a match that begins and ends on a word boundary in
 * the original — without that rule "mass hole" folds to "masshole" and matches
 * an insult that nobody wrote.
 */
export function censor(input: string): { text: string; censored: boolean } {
  const folded = fold(input);
  if (!folded.letters) return { text: input, censored: false };

  const spans: Array<[number, number]> = [];

  // --- Pass A: token-exact -------------------------------------------------
  let k = 0;
  while (k < folded.letters.length) {
    if (!folded.startsWord[k]) {
      k++;
      continue;
    }
    let end = k;
    while (end + 1 < folded.letters.length && !folded.endsWord[end]) end++;
    const token = folded.letters.slice(k, end + 1);
    if (tokenHits(token)) spans.push([folded.map[k], folded.map[end]]);
    k = end + 1;
  }

  // --- Pass B: separator evasion ------------------------------------------
  for (const word of ORDINARY) {
    let from = 0;
    for (;;) {
      const at = folded.letters.indexOf(word, from);
      if (at < 0) break;
      from = at + 1;
      const endK = at + word.length - 1;
      if (!folded.startsWord[at] || !folded.endsWord[endK]) continue;
      const originalSpan = input.slice(folded.map[at], folded.map[endK] + 1);
      // Pass A already handles the unseparated form; only act when the writer
      // actually inserted something between the letters.
      if (originalSpan.length === word.length) continue;
      spans.push([folded.map[at], folded.map[endK]]);
    }
  }

  if (!spans.length) return { text: input, censored: false };

  spans.sort((a, b) => a[0] - b[0]);
  let out = "";
  let cursor = 0;
  for (const [from, to] of spans) {
    if (from < cursor) continue; // overlapping match already covered
    out += input.slice(cursor, from) + starsFor(input, from, to);
    cursor = to + 1;
  }
  out += input.slice(cursor);
  return { text: out, censored: true };
}

/* ------------------------------------------------------------------ *
 * Entry point
 * ------------------------------------------------------------------ */

function matchAll(text: string, patterns: Array<[RegExp, string]>): string[] {
  const hit: string[] = [];
  for (const [re, code] of patterns) if (re.test(text)) hit.push(code);
  return hit;
}

/**
 * Moderate one piece of public free text.
 *
 * `field` only affects reporting; every public string goes through the same
 * rules. Technical metadata (Mac model, macOS version, profile) is validated by
 * an allowlist elsewhere and never reaches this function, so "MacBook Air" can
 * never be mangled by a word filter.
 */
export function moderate(input: string, field: string): ModerationResult {
  const text = input.normalize("NFKC").replace(INVISIBLE, "");
  const folded = fold(text);
  const flags: string[] = [];

  // --- L3: reject outright -------------------------------------------------
  const attacks = matchAll(text, ATTACK_PATTERNS);
  if (attacks.length) {
    return { severity: "rejected", text: "", flags: attacks.map((a) => `${field}:${a}`), censored: false };
  }
  const spam = matchAll(text, SPAM_PATTERNS);
  if (linkCount(text) >= LINK_FLOOD_THRESHOLD) spam.push("spam_link_flood");
  if (spam.length >= 2 || URL_DENY.test(text)) {
    return {
      severity: "rejected",
      text: "",
      flags: [...spam, URL_DENY.test(text) ? "spam_denied_tld" : ""].filter(Boolean).map((s) => `${field}:${s}`),
      censored: false,
    };
  }
  if (spam.length === 1) flags.push(`${field}:${spam[0]}`);

  // --- L2: hold for a human ------------------------------------------------
  for (const term of HATE) {
    // Hate terms are matched on the folded projection so leetspeak does not
    // walk past, and on word boundaries so ordinary words are not swept up.
    let from = 0;
    for (;;) {
      const at = folded.letters.indexOf(term, from);
      if (at < 0) break;
      from = at + 1;
      if (folded.startsWord[at] && folded.endsWord[at + term.length - 1]) {
        flags.push(`${field}:hate_speech`);
        break;
      }
    }
  }
  flags.push(...matchAll(text, THREAT_PATTERNS).map((c) => `${field}:${c}`));
  flags.push(...matchAll(text, DOXX_PATTERNS).map((c) => `${field}:${c}`));
  flags.push(...matchAll(text, EXPLICIT_PATTERNS).map((c) => `${field}:${c}`));

  // --- L1: censor and publish ---------------------------------------------
  const { text: clean, censored } = censor(text);
  const unique = [...new Set(flags)];

  if (unique.some((f) => !f.endsWith(":spam_keyword") && !f.endsWith(":spam_shortlink") && !f.endsWith(":spam_contact"))) {
    return { severity: "flagged", text: clean, flags: unique, censored };
  }
  if (unique.length) return { severity: "flagged", text: clean, flags: unique, censored };
  return { severity: censored ? "censored" : "clean", text: clean, flags: [], censored };
}
