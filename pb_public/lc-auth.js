// lc-auth.js — LoopCheck's single authentication helper (ADR 0011 §6).
//
// The ONE deliberate exception to the self-contained-page convention: auth
// logic duplicated across ~15 pages would drift, and drift in auth code becomes
// lockouts or holes. Loaded before Alpine; pages use window.lcAuth.
//
// Model (ADR 0011): the maintainer creates accounts in the admin UI — a shared
// field account per crew/project, personal accounts for PMs. NO self-signup.
// The field tier stays accountless (public reads + the one public punch write),
// so most pages never call this; it gates the office/authenticated actions
// (logging a check, building/signing a turnover, closing a punch, office reads).
//
// Talks to PocketBase's built-in auth endpoints with plain fetch — no SDK, no
// added bytes. The token is the raw PocketBase JWT in the Authorization header
// (PocketBase accepts it without a "Bearer" prefix).
window.lcAuth = (function () {
  const PB = window.location.origin;
  const TKEY = "lc_token", UKEY = "lc_user";

  function token() { return localStorage.getItem(TKEY) || ""; }
  function user() {
    try { return JSON.parse(localStorage.getItem(UKEY) || "null"); } catch (e) { return null; }
  }
  function isAuthed() { return !!token(); }
  // Spread into a fetch headers object: fetch(url, { headers: { ...lcAuth.header() } })
  function header() { return token() ? { Authorization: token() } : {}; }
  function save(t, rec) {
    localStorage.setItem(TKEY, t);
    localStorage.setItem(UKEY, JSON.stringify(rec || null));
  }
  function clear() { localStorage.removeItem(TKEY); localStorage.removeItem(UKEY); }

  async function login(identity, password) {
    const res = await fetch(`${PB}/api/collections/users/auth-with-password`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identity, password }),
    });
    if (!res.ok) throw new Error("Invalid email or password.");
    const data = await res.json();
    save(data.token, data.record);
    return data.record;
  }

  function logout() { clear(); }

  // Validate / renew the stored token on page load. PocketBase treats a
  // missing or expired token on a READ as a guest (empty list, HTTP 200 — NOT
  // 401), so expiry cannot be detected from a read's status: it is detected
  // here, by asking auth-refresh. Offline, we trust the local token and let the
  // server re-judge writes on reconnect (ADR 0011 / ADR 0007 offline rule).
  async function refresh() {
    if (!token()) return null;
    try {
      const res = await fetch(`${PB}/api/collections/users/auth-refresh`, {
        method: "POST", headers: { Authorization: token() },
      });
      if (res.status === 401 || res.status === 403 || res.status === 404) { clear(); return null; }
      if (!res.ok) return user(); // transient server issue — keep the local session
      const data = await res.json();
      save(data.token, data.record);
      return data.record;
    } catch (e) {
      return user(); // offline: trust the local token
    }
  }

  // Redirect to login, preserving where we were so a scanned QR → login → the
  // page it pointed at (login.html reads ?next=).
  function requireAuth() {
    if (isAuthed()) return true;
    location.href = "/login.html?next=" + encodeURIComponent(location.pathname + location.search);
    return false;
  }

  function displayName() {
    const u = user();
    return u ? (u.name || u.email || "") : "";
  }

  return { token, user, isAuthed, header, login, logout, refresh, requireAuth, displayName };
})();
