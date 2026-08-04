/// <reference path="../pb_data/types.d.ts" />
//
// Turnover package build route (ADR 0010, Phase 3).
//
// POST /api/turnover/build  { project, system?, title?, generated_by? }  (AUTH)
//
// A client cannot be trusted to compute the manifest and hash of what it
// claims the ledger contains — a forged manifest could sign a package that
// omits the failing check. So the CORE assembles the package here, server-side:
// it queries the ledger itself, freezes a canonical manifest, computes the
// content hash, derives the standing snapshot, and creates the append-only
// turnover_packages record via $app.save() (which bypasses that collection's
// createRule: null — the ONLY sanctioned creator). The client then collects
// signatures against the frozen package id it gets back.
//
// The canonical serializer lives in ./turnover_canon.js and is require()-d both
// here (golden self-check) and inside the handler — PocketBase runs each route
// handler in an isolated scope that cannot see this file's top-level bindings.

// ---- Golden vector: the cheapest defense against canonicalization drift -----
// The fixture and its pinned digest live in turnover_canon.js beside the
// serializer. This shouts at load; the BUILD ROUTE refuses (below), which is
// where it matters — a mismatch means every hash written from here on is
// unreproducible by any independent verifier, and an unverifiable hash on a
// signed turnover package is worse than no package at all.
//
// Deliberately NOT a throw at load. A drifted turnover canonicalizer must not
// take down an instance whose first job is serving QR scans, LOTO status, and
// field checks — "never cripple the field tier" outranks failing fast about an
// office deliverable. The blast radius is scoped to turnover builds.
(function goldenVectorSelfCheck() {
  const canon = require(`${__hooks}/turnover_canon.js`);
  const v = canon.verifyGoldenVector();
  if (!v.ok) {
    console.log("[turnover] GOLDEN VECTOR MISMATCH — canonical hash drifted! expected", v.expected, "got", v.got);
    console.log("[turnover] /api/turnover/build will REFUSE until this is resolved (ADR 0010).");
  }
})();

// ---- The build route --------------------------------------------------------
routerAdd("POST", "/api/turnover/build", (e) => {
 try {
  const canon = require(`${__hooks}/turnover_canon.js`);

  // REFUSE TO SEAL EVIDENCE WE CANNOT PROVE. If the canonical serializer has
  // drifted from the pinned golden vector, any content_hash written here is
  // unreproducible by the paid sidecar or an outside expert's verifier — so the
  // package would LOOK sealed while being worthless in the dispute it exists
  // for. Refusing is the honest outcome; the ledger itself is untouched and
  // every field workflow keeps running.
  const golden = canon.verifyGoldenVector();
  if (!golden.ok) {
    return e.json(500, {
      message: "Turnover build refused: the canonical hash vector does not match " +
               "(ADR 0010, sha256-canon-v1). A package built now could not be " +
               "independently verified. Resolve the canonicalizer drift first.",
      expected: golden.expected,
      got: golden.got,
    });
  }

  // Auth required (office action). requireAuth() middleware already ran; this
  // also yields the signer identity for generated_by.
  const auth = e.auth;
  if (!auth) return e.json(401, { message: "Authentication required to build a turnover package." });

  const body = new DynamicModel({ project: "", system: "", title: "", generated_by: "" });
  e.bindBody(body);
  if (!body.project) return e.json(400, { message: "project is required." });

  $app.findRecordById("projects", body.project); // 404s if the project is bogus
  const systemId = body.system || "";

  // ---- Gather the ledger for the scope ------------------------------------
  let checkFilter, punchFilter, lotoFilter, reqFilter, params;
  if (systemId) {
    params = { sid: systemId };
    checkFilter = "tag.system = {:sid} || system = {:sid}";
    punchFilter = "status = 'open' && (tag.system = {:sid} || system = {:sid})";
    lotoFilter = "tag.system = {:sid}";
    reqFilter = "tag.system = {:sid}";
  } else {
    params = { pid: body.project };
    checkFilter = "tag.project = {:pid} || system.project = {:pid}";
    punchFilter = "status = 'open' && (tag.project = {:pid} || system.project = {:pid})";
    lotoFilter = "project = {:pid}";
    reqFilter = "project = {:pid}";
  }

  // Generous ceiling; if a scope somehow exceeds it, the manifest is marked
  // truncated (below) so a partial ledger is never silently sealed as complete.
  const LIMIT = 20000;
  const checks = $app.findRecordsByFilter("checks", checkFilter, "performed_at", LIMIT, 0, params);
  const punches = $app.findRecordsByFilter("punch_items", punchFilter, "severity", LIMIT, 0, params);
  const lotoEvents = $app.findRecordsByFilter("loto_events", lotoFilter, "created", LIMIT, 0, params);
  let reqs = [];
  try { reqs = $app.findRecordsByFilter("closeout_requirements", reqFilter, "req_type", LIMIT, 0, params); }
  catch (err) { reqs = []; }

  // check_items for the WHOLE scope in ONE query (avoid N+1), traversing the
  // same relation one level deeper (check.tag.system / check.system). Grouped
  // by check id; the "created" sort preserves answered-line order per check.
  let itemsFilter, itemsParams;
  if (systemId) { itemsFilter = "check.tag.system = {:sid} || check.system = {:sid}"; itemsParams = { sid: systemId }; }
  else { itemsFilter = "check.tag.project = {:pid} || check.system.project = {:pid}"; itemsParams = { pid: body.project }; }
  const allItems = $app.findRecordsByFilter("check_items", itemsFilter, "created", LIMIT, 0, itemsParams);
  const itemsByCheck = {};
  for (const it of allItems) {
    const k = it.getString("check");
    (itemsByCheck[k] = itemsByCheck[k] || []).push(it);
  }

  const truncated = checks.length >= LIMIT || punches.length >= LIMIT ||
                    lotoEvents.length >= LIMIT || allItems.length >= LIMIT;

  // ---- Build the manifest (per-collection field allowlist, ADR 0010) -------
  const records = [];
  const openPunch = { A: 0, B: 0, C: 0 };
  const includedIds = [];

  for (const c of checks) {
    const items = itemsByCheck[c.id] || [];
    records.push({
      collection: "checks",
      id: c.id,
      phase: c.getString("phase"),
      result: c.getString("result"),
      performed_by: c.getString("performed_by"),
      performed_at: canon.rfc3339(c.getString("performed_at")),
      // check_items freeze prompt/result/value/note at execution (ADR 0001);
      // response_type stays on the living template, so it is not part of the
      // frozen evidentiary content. These four are the answered-line substance
      // a dispute turns on.
      check_items: items.map((it) => ({
        prompt: it.getString("prompt"),
        result: it.getString("result"),
        value: it.getString("value"),
        note: it.getString("note"),
      })),
    });
    includedIds.push(c.id);
  }

  for (const p of punches) {
    const sev = p.getString("severity");
    if (openPunch[sev] !== undefined) openPunch[sev]++;
    records.push({ collection: "punch_items", id: p.id, severity: sev, status: p.getString("status") });
    includedIds.push(p.id);
  }

  // LOTO: freeze the DERIVED active-lock state (an apply with no release).
  const released = {};
  for (const ev of lotoEvents) {
    if (ev.getString("action") === "release" && ev.getString("applies_to")) {
      released[ev.getString("applies_to")] = true;
    }
  }
  let activeLocks = 0;
  for (const ev of lotoEvents) {
    if (ev.getString("action") === "apply" && !released[ev.id]) {
      activeLocks++;
      records.push({ collection: "loto_events", id: ev.id, active: true,
        lock_holder_name: ev.getString("lock_holder_name") });
    }
  }

  for (const r of reqs) {
    records.push({ collection: "closeout_requirements", id: r.id,
      req_type: r.getString("req_type"), status: r.getString("status") });
  }

  // Attachments referenced by included checks / punch items. Per ADR 0010 the
  // lighter {id, filename} binding (per-byte hashing is too heavy for every
  // photo at build time on a Pi) — residual swap risk documented in the ADR.
  if (includedIds.length) {
    const ors = includedIds.map((id, i) => "parent_id = {:pid" + i + "}").join(" || ");
    const aParams = {};
    includedIds.forEach((id, i) => { aParams["pid" + i] = id; });
    let atts = [];
    try { atts = $app.findRecordsByFilter("attachments", "(" + ors + ")", "created", 3000, 0, aParams); }
    catch (err) { atts = []; }
    for (const a of atts) {
      records.push({ collection: "attachments", id: a.id,
        parent_collection: a.getString("parent_collection"),
        filename: a.getString("file") });
    }
  }

  // Deterministic order so the hash is stable regardless of query order.
  records.sort((x, y) => (x.collection + x.id < y.collection + y.id ? -1 : 1));

  const manifest = {
    algo: "sha256-canon-v1",
    scope: { project: body.project, system: systemId || null },
    records: records,
  };
  // Only present when true, so a normal (complete) package's hash is unchanged.
  // A truncated manifest is sealed AS truncated — never silently as complete.
  if (truncated) manifest.truncated = true;

  // ---- Derived standing snapshot, frozen at build time --------------------
  const standing = {
    records_included: records.length,
    checks_included: checks.length,
    open_punch: openPunch,
    active_locks: activeLocks,
    ready_no_a_blockers: openPunch.A === 0,
    truncated: truncated,
  };

  // ---- Create the append-only package (bypasses createRule: null) ----------
  const now = new Date().toISOString().replace("T", " ").slice(0, 23) + "Z";
  const col = $app.findCollectionByNameOrId("turnover_packages");
  const pkg = new Record(col);
  pkg.set("project", body.project);
  if (systemId) pkg.set("system", systemId);
  pkg.set("title", body.title || (systemId ? "System turnover" : "Project turnover"));
  pkg.set("manifest", manifest);
  pkg.set("standing_snapshot", standing);
  pkg.set("content_hash", canon.contentHash(manifest));
  pkg.set("hash_algo", "sha256-canon-v1");
  pkg.set("generated_by", body.generated_by || auth.getString("email") || "unspecified");
  pkg.set("generated_at", now);

  // Supersession (C3): a re-issue after more work replaces the prior package
  // for the SAME scope, so the new package points at the latest existing one.
  // Signatures do NOT carry forward — the new package starts unsigned and
  // everyone re-attests; the superseded package and its signatures stay in the
  // ledger as history. "Current package for a scope" = the one no other
  // package supersedes (derived by readers).
  let priorFilter, priorParams;
  if (systemId) { priorFilter = "system = {:sid}"; priorParams = { sid: systemId }; }
  else { priorFilter = "project = {:pid} && system = ''"; priorParams = { pid: body.project }; }
  const priors = $app.findRecordsByFilter("turnover_packages", priorFilter, "-created", 1, 0, priorParams);
  if (priors.length) pkg.set("supersedes", priors[0].id);

  $app.save(pkg);

  return e.json(200, {
    id: pkg.id,
    content_hash: pkg.getString("content_hash"),
    hash_algo: "sha256-canon-v1",
    standing: standing,
    records: records.length,
  });
 } catch (err) {
   // Log the detail server-side; return a generic message (don't leak internals
   // or a bogus-id 404 as a build failure to the caller).
   console.log("[turnover] BUILD ERROR:", String(err), err && err.stack ? err.stack : "");
   return e.json(400, { message: "Could not build the turnover package. Check the project/system ids." });
 }
}, $apis.requireAuth());
