---
name: Life Tracker passcode access
description: Authentication constraint for the Life Tracker product.
---

Life Tracker must remain passcode-only and must not require account signup. In embedded browser previews, its session cookie must use `SameSite=None; Secure` so the first protected API request retains the session. Pair this with same-origin CORS and mutation-origin checks; do not make cross-site credentialed requests readable or writable.

**Why:** the user explicitly chose a simple passcode flow. Replit's embedded preview can be cross-site relative to its parent page, so a `SameSite=Lax` cookie lets unlock succeed but blocks the follow-up API request. Allowing cross-site cookies without origin checks would introduce CSRF and data exposure risks.

**How to apply:** keep protected routes behind the passcode session; do not introduce individual accounts or bypass authentication. Verify sign-in in both a top-level browser tab and an embedded preview after auth changes, and keep session responses uncacheable.
