/// <reference path="../pb_data/types.d.ts" />
//
// Canonical serialization for turnover packages (ADR 0010, sha256-canon-v1).
//
// A CommonJS module (NOT a *.pb.js hook), required from turnover.pb.js. It
// lives on its own because PocketBase runs each hook/route handler in an
// isolated goja scope that cannot see file-level functions — shared logic has
// to be require()-d, both at load (the golden self-check) and inside the route.
//
// The form is pinned so the goja builder, the paid sidecar, and an outside
// expert's verifier agree on the bytes:
//   - object keys sorted lexicographically by UTF-8 code unit, no whitespace
//   - strings Unicode NFC, JSON-escaped
//   - integers as integers; decimals travel as strings (check values are text)
//   - booleans literal; null/undefined members omitted (absent == null)

function canonical(value) {
  if (value === null || value === undefined) return "null";
  const t = typeof value;
  if (t === "string") {
    const s = value.normalize ? value.normalize("NFC") : value;
    return JSON.stringify(s);
  }
  if (t === "number") {
    return Number.isInteger(value) ? String(value) : JSON.stringify(String(value));
  }
  if (t === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) {
    return "[" + value.map(canonical).join(",") + "]";
  }
  // INVARIANT: every manifest object key is a fixed ASCII field name
  // (collection, id, result, check_items, …). For ASCII, JS .sort() (UTF-16
  // code units) is byte-for-byte identical to the pinned UTF-8 byte order, so
  // the goldenvector and any other-language verifier agree. Do NOT introduce a
  // non-ASCII / user-controlled key here without switching to an explicit
  // UTF-8 byte-order sort, or the cross-implementation hash will diverge.
  const keys = Object.keys(value)
    .filter((k) => value[k] !== null && value[k] !== undefined)
    .sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
}

// $security wraps Go crypto/sha256 -> lowercase hex. ($security is a JSVM
// global, available inside required modules too.)
function contentHash(manifest) {
  return $security.sha256(canonical(manifest));
}

// PocketBase stores dates "YYYY-MM-DD HH:MM:SS.sssZ"; freeze as RFC 3339 UTC.
function rfc3339(s) {
  if (!s) return "";
  return String(s).replace(" ", "T");
}

module.exports = { canonical, contentHash, rfc3339 };
