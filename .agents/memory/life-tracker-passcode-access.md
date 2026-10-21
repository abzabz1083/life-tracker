---
name: Life Tracker passcode access
description: Authentication constraint for the Life Tracker product.
---

Life Tracker must remain passcode-only and must not require account signup. Keep the HttpOnly session cookie as the primary credential, but also return the signed session token on unlock and keep it in per-tab `sessionStorage` for a same-origin bearer fallback. Embedded browsers may block the cookie even with `SameSite=None; Secure`. Session checks must return their JSON body even when a browser sends conditional-cache headers. Pair both auth methods with same-origin CORS and mutation-origin checks; do not make cross-site credentialed requests readable or writable.

For PWA support, cache only the static app shell and assets. Never cache authentication/session API responses or private tracker data; offline access should not bypass the passcode or imply that tracker features work without a connection.

**Why:** the user explicitly chose a simple passcode flow. Replit's embedded preview can be cross-site relative to its parent page, and some browsers block third-party cookies even with `SameSite=None; Secure`, so unlock can succeed while the first protected API request returns 401. The bearer fallback fixes that without relying on third-party cookie availability. Express may also respond with a bodyless 304 to conditional session requests despite `Cache-Control: no-store`, which can look like a locked session to generated clients. Broad cross-origin access would introduce CSRF and data-exposure risks.

**How to apply:** keep protected routes behind the passcode session; do not introduce individual accounts or bypass authentication. Validate cookie and bearer tokens with the same signature and expiry, attach browser tokens only to same-origin API requests, clear them on logout/401, verify with third-party cookies disabled, and ignore conditional validators on session checks so they always return JSON. If adding PWA caching or offline actions, limit the service worker to static assets unless a separate, explicitly designed offline-data security model is in place.
