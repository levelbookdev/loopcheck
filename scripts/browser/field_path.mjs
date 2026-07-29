// LoopCheck field-path browser smoke (task 040, DECISIONS.md D16).
//
// Four assertions covering what a person with a phone and no account actually
// does. The REST suite (scripts/smoke_test.sh) cannot see any of this: it would
// stay green while a broken Alpine binding served an empty shell.
//
// Run via ../browser_test.sh, which boots and seeds a throwaway instance.
// LC_BASE points at it.
//
// ALPINE NOTE (this cost an hour once -- see the task file): synthetic `input`
// events do NOT reliably drive Alpine's x-model. Set state through
// Alpine.$data(root) and call the component's own method instead of typing into
// fields and dispatching events.

import { chromium } from "playwright";

const BASE = process.env.LC_BASE;
if (!BASE) {
  console.error("FATAL: LC_BASE is not set. Run scripts/browser_test.sh instead.");
  process.exit(2);
}

let pass = 0, fail = 0;
const ok  = (m) => { pass++; console.log(`  PASS  ${m}`); };
const bad = (m) => { fail++; console.log(`  FAIL  ${m}`); };

// Assert on RENDERED CONTENT, never on HTTP status. A page that 200s with an
// empty shell is the exact failure this suite exists to catch -- the same
// "confident absence" trap that let a stale deployment look protected.
const seen = (haystack, needle, label) => {
  if (haystack.includes(needle)) return ok(label);
  // On failure, show what DID render. Without this you cannot tell a missing
  // element from a page that never finished loading -- they look identical.
  bad(`${label} -- not found. Rendered ${haystack.length} chars, starts: ` +
      JSON.stringify(haystack.trim().slice(0, 220)));
};

const api = async (path) => {
  const r = await fetch(`${BASE}${path}`);
  if (!r.ok) throw new Error(`${path} -> HTTP ${r.status}`);
  return r.json();
};

// Open a tag page and wait until its Alpine component reports state='ready'.
//
// `networkidle` is NOT sufficient here and quietly produced four false failures
// while building this: tag.html's load() runs several sequential fetches, so the
// page briefly renders a real-looking partial (header + LOTO heading, no
// standing, no honesty line). Waiting on the component's own state is the only
// honest "finished" signal.
//
// Returns the WHOLE page text, not <main> -- the tag number lives in
// <header class="bar">, outside main. Reading only main was the other false
// failure.
const openTag = async (url) => {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    const root = document.querySelector('[x-data="tagPage()"]');
    const c = root && window.Alpine?.$data(root);
    return !!c && c.state !== "loading";
  }, { timeout: 20000 });
  const state = await page.evaluate(() =>
    window.Alpine.$data(document.querySelector('[x-data="tagPage()"]')).state);
  if (state !== "ready") bad(`tag page settled in state='${state}', expected 'ready'`);
  return page.innerText("body");
};

const browser = await chromium.launch();
const page = await browser.newPage();
page.on("pageerror", (e) => bad(`uncaught page error: ${e.message}`));

try {
  // Pick a real seeded tag rather than hardcoding, so the suite survives seed
  // edits -- but pick one whose tag_type actually HAS a checklist template.
  // Not every type does (the first tag alphabetically was an 'analyzer', which
  // has none), and a tag with no template cannot exercise the check flow.
  const tplList = await api(
    "/api/collections/checklist_templates/records?perPage=200" +
    `&filter=${encodeURIComponent("subject_kind='tag'")}&fields=id,tag_type,phase`);
  const templated = new Set(tplList.items.map((t) => t.tag_type).filter(Boolean));
  const tagList = await api("/api/collections/tags/records?perPage=200&sort=tag_number");
  const tag = tagList.items.find((t) => templated.has(t.tag_type)) || tagList.items[0];
  if (!tag) { console.error("FATAL: seed produced no tags."); process.exit(2); }
  const tpl = tplList.items.find((t) => t.tag_type === tag.tag_type);
  console.log(`    (subject: ${tag.tag_number}, tag_type=${tag.tag_type})`);
  const TAG_URL = `${BASE}/t/${encodeURIComponent(tag.tag_number)}`;

  // ---- 1. the clean QR route renders a real tag page ------------------------
  // This is the promise printed on every label. It must serve tag.html AND that
  // page must actually populate -- an empty shell here is a dead field tier.
  console.log("==> 1. /t/{tag_number} renders (the printed-QR promise)");
  let body = await openTag(TAG_URL);
  seen(body, tag.tag_number, `tag number "${tag.tag_number}" rendered`);
  if (/CHECKOUT STANDING/i.test(body)) ok("checkout standing section rendered");
  else bad("checkout standing section missing");
  if (body.trim().length > 200) ok(`page has real content (${body.trim().length} chars)`);
  else bad(`page rendered an empty shell (${body.trim().length} chars)`);

  // ---- 2. LOTO honesty invariant (ADR 0007) --------------------------------
  // Non-negotiable and safety-relevant: every LOTO display carries its data
  // freshness and the physical-verification line. Its absence is a safety
  // regression, not a cosmetic one -- so it is asserted on the rendered page,
  // where a broken binding would remove it silently.
  console.log("==> 2. LOTO banner keeps its honesty line (ADR 0007)");
  seen(body, "Verify physically before any work.", "LOTO physical-verification line present");
  if (/\b(Last synced|As of)\b/i.test(body)) ok("LOTO data-freshness timestamp present");
  else bad("LOTO freshness timestamp missing -- stale status could read as current");

  // ---- 3. flag a punch item, accountless ------------------------------------
  // The one write hard constraint #1 names explicitly. Driven through the page's
  // own Alpine component, so a broken form binding fails here.
  console.log("==> 3. flag a punch item with no account");
  const marker = `browser-smoke defect ${Date.now()}`;
  const flagged = await page.evaluate(async (desc) => {
    const root = document.querySelector('[x-data="tagPage()"]');
    if (!root) return "no tagPage root";
    const c = window.Alpine?.$data(root);
    if (!c) return "Alpine.$data unavailable";
    c.showFlag = true;
    c.flagDesc = desc;
    c.flagSev = "C";              // cosmetic -- must not block the demo project
    c.flagBy = "Browser Smoke";
    await c.flag();
    return c.flagError || "";
  }, marker);
  if (flagged) { bad(`punch flag rejected: ${flagged}`); }
  else {
    body = await openTag(TAG_URL);
    seen(body, marker, "flagged punch item reads back on the tag page");
  }

  // ---- 4. log a check and read it back --------------------------------------
  // The core append-and-read-back promise: log a check, see it in the ledger.
  // Uses a template that matches this tag's type, the same way the UI picks one.
  console.log("==> 4. log a check and read it back from the ledger");
  if (!tpl) {
    bad(`no checklist template for tag_type='${tag.tag_type}' -- cannot log a check`);
  } else {
    const who = `Browser Smoke ${Date.now()}`;
    await page.goto(`${BASE}/check.html?tag=${tag.id}&template=${tpl.id}`,
                    { waitUntil: "networkidle" });
    await page.waitForSelector('[x-data="checkPage()"]', { timeout: 15000 });
    const err = await page.evaluate(async (name) => {
      const root = document.querySelector('[x-data="checkPage()"]');
      const c = window.Alpine?.$data(root);
      if (!c) return "Alpine.$data unavailable";
      if (!c.template) return "template did not load";
      // Answer every pass/fail/N-A line PASS; other response types may stay
      // blank (they record as skipped, which is a legal check result).
      for (const it of c.items) {
        if (it.response_type === "pass_fail_na") c.ans[it.id].result = "pass";
      }
      c.performedBy = name;
      if (c.template.witness_required) c.witnessedBy = name;
      await c.submit();
      return c.submitError || "";
    }, who);

    if (err) { bad(`check submit rejected: ${err}`); }
    else {
      body = await openTag(TAG_URL);
      seen(body, who, "logged check appears in the tag's check history");
    }
  }
} catch (e) {
  bad(`unexpected failure: ${e.message}`);
} finally {
  await browser.close();
}

console.log("");
console.log("-------------------------------------------------------------");
console.log(`browser smoke: ${pass} passed, ${fail} failed`);
console.log("-------------------------------------------------------------");
if (fail > 0) {
  console.error("FIELD PATH REGRESSED -- do not land this until green.");
  process.exit(1);
}
console.log("OK -- the critical field path renders and accepts field writes.");
