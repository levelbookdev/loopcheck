/// <reference path="../pb_data/types.d.ts" />
//
// LoopCheck server hooks.
//
// The one job here: make the clean tag URL work. QR labels encode plain
// human-readable URLs — /t/PMP-3101 — because the P&ID tag number is the
// project's language and a QR that reads "/t/PMP-3101" is scannable by any
// stock phone camera with no app. PocketBase serves static files by exact
// path, so /t/{tag_number} would 404 without this route.
//
// The route serves the tag-page shell (pb_public/tag.html). That page reads
// the tag number back out of window.location.pathname and queries the API —
// so the address bar keeps the clean URL and there is no redirect round-trip.

routerAdd("GET", "/t/{tagNumber}", (e) => {
  // Serve the static shell from pb_public. `$os.dirFS` gives an fs rooted at
  // that directory; `e.fileFS` streams the named file with correct headers.
  // __hooks is the absolute path to this pb_hooks directory.
  return e.fileFS($os.dirFS(`${__hooks}/../pb_public`), "tag.html");
});

// Service connections (ADR 0006): /s/{serviceId} serves the service page the
// same way. The id is the PocketBase record id, NOT the address — addresses
// are neither unique nor URL-clean, and the PII rule forbids anything
// person-identifying in a URL or QR code. The page shows the address big;
// the URL stays opaque.
routerAdd("GET", "/s/{serviceId}", (e) => {
  return e.fileFS($os.dirFS(`${__hooks}/../pb_public`), "service.html");
});
