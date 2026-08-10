/**
 * Moderation tests.
 *
 * The false-positive cases matter more than the catches: a filter that mangles
 * "assess" or "Scunthorpe" is worse than one that misses an evasion, because it
 * silently corrupts honest writing.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { moderate, censor } from "../dist-test/moderate.js";

const body = (s) => moderate(s, "body");

test("clean text passes through untouched", () => {
  const input = "Fans are noticeably quieter on Balanced. Peak dropped about 6F on my M3 Pro.";
  const r = body(input);
  assert.equal(r.severity, "clean");
  assert.equal(r.text, input);
  assert.equal(r.censored, false);
});

test("ordinary profanity is censored but still publishes", () => {
  const r = body("This is fucking brilliant, my fans finally shut up during builds.");
  assert.equal(r.severity, "censored");
  // The whole token is starred rather than leaving a first letter: a partial
  // mask still tells you the word, which defeats the point.
  assert.match(r.text, /\*{7} brilliant/);
  assert.ok(!r.text.includes("fucking"));
  assert.ok(r.text.endsWith("my fans finally shut up during builds."));
  assert.equal(r.flags.length, 0);
});

test("asterisks roughly preserve length", () => {
  const { text } = censor("what the shit");
  assert.equal(text, "what the ****");
});

for (const [label, input, mustNotContain] of [
  ["leetspeak", "this is sh1t honestly", "sh1t"],
  ["symbols", "total bullsh!t", "bullsh!t"],
  ["repeats", "fuuuuck this is loud", "fuuuuck"],
  ["dots", "f.u.c.k these fans", "f.u.c.k"],
  ["spaces", "f u c k the noise", "f u c k"],
  ["at-sign", "what an @sshole review", "@sshole"],
  ["cyrillic", "this is ѕhit", "ѕhit"],
]) {
  test(`bypass caught: ${label}`, () => {
    const r = body(`${input} but the governor works well and I would recommend it.`);
    assert.ok(r.censored, `${label} was not censored: ${r.text}`);
    assert.ok(!r.text.includes(mustNotContain), `${label} left the original in: ${r.text}`);
  });
}

for (const phrase of [
  "I need to assess the thermal behaviour before I pass judgement.",
  "The class of machines this targets is the MacBook Pro.",
  "Scunthorpe is where I bought my Mac.",
  "Analysis of the fan curve shows a smoother ramp.",
  "The cockpit view of the dashboard is great.",
  "Massive improvement, no compass needed.",
  "Bypass the noise, this just works.",
  "My therapist says I should stop worrying about fan noise.",
]) {
  test(`no false positive: ${phrase.slice(0, 32)}...`, () => {
    const r = body(`${phrase} It has been running for three weeks without a problem at all.`);
    assert.equal(r.censored, false, `wrongly censored: ${r.text}`);
    assert.ok(r.text.includes(phrase), `text was altered: ${r.text}`);
  });
}

test("mass hole does not become an insult", () => {
  const r = body("There is a mass hole in my understanding of SMC fan curves, honestly speaking.");
  assert.equal(r.censored, false, `wrongly censored: ${r.text}`);
});

test("threats are flagged, not published", () => {
  const r = body("I will kill you if this app touches my fans again, I mean it seriously.");
  assert.equal(r.severity, "flagged");
  assert.ok(r.flags.some((f) => f.endsWith(":threat")));
});

test("self-harm encouragement is flagged", () => {
  const r = body("kys, this software is garbage and you should feel bad about writing it.");
  assert.equal(r.severity, "flagged");
  assert.ok(r.flags.some((f) => f.includes("self_harm")));
});

test("hate speech is flagged and never echoed in flags", () => {
  const slur = Buffer.from("bmlnZ2Vy", "base64").toString();
  const r = body(`${slur} developers made this, terrible work all round and I want a refund.`);
  assert.equal(r.severity, "flagged");
  assert.ok(r.flags.some((f) => f.endsWith(":hate_speech")));
  assert.ok(!r.flags.join(" ").includes(slur), "flag codes leaked the term");
});

test("possible personal data is flagged", () => {
  const r = body("Contact me at 555-123-4567 about this thermal governor, it works fine overall.");
  assert.equal(r.severity, "flagged");
  assert.ok(r.flags.some((f) => f.includes("possible_phone")));
});

for (const [label, payload] of [
  ["script tag", "<script>alert(1)</script> great app otherwise and very quiet fans"],
  ["img onerror", `<img src=x onerror=alert(document.cookie)> nice tool for thermal control`],
  ["javascript uri", "check javascript:alert(1) for details about this fan governor app"],
  ["svg", "<svg/onload=alert(1)> the fans are quiet now which is what I wanted"],
  ["template", "${process.env.SECRET} good app for keeping the machine cool and quiet"],
  ["sqli", "'; DROP TABLE reviews; -- excellent thermal governor for my MacBook Pro"],
]) {
  test(`hard reject: ${label}`, () => {
    const r = body(payload);
    assert.equal(r.severity, "rejected", `not rejected: ${JSON.stringify(r)}`);
    assert.equal(r.text, "", "rejected content must not be kept");
  });
}

test("link flood is rejected", () => {
  const r = body("https://a.com https://b.com https://c.com https://d.com best casino bonus now");
  assert.equal(r.severity, "rejected");
});

test("negative but respectful criticism publishes untouched", () => {
  const input =
    "Two stars. The daemon is solid but the menu bar app never compiled on my machine, " +
    "and doctor kept reporting a stale sudoers path until I reinstalled twice.";
  const r = body(input);
  assert.equal(r.severity, "clean");
  assert.equal(r.text, input);
  assert.equal(r.flags.length, 0);
});

test("harsh wording alone does not flag", () => {
  const input =
    "Honestly this is the worst thermal utility I have tried, it did nothing for my Air and " +
    "the install was confusing. I do not recommend it to anyone at all.";
  const r = body(input);
  assert.notEqual(r.severity, "flagged");
  assert.notEqual(r.severity, "rejected");
});

test("moderation never returns the uncensored original", () => {
  const r = body("this shit is great, genuinely quieter than before on every single workload");
  assert.ok(!r.text.includes("shit"));
  assert.ok(!JSON.stringify(r).includes("shit"));
});
