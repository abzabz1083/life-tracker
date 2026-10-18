---
name: Vite React dependency cache
description: A workspace-specific Vite cache issue where prebundled React dependencies can stay stale after package versions change.
---

When the package manager resolves matching React and React DOM versions but the browser reports a version mismatch, inspect Vite's optimized dependency cache before changing package versions again. Removing the app's generated `.vite` dependency cache and restarting Vite regenerated compatible bundles.

**Why:** The preview retained a prebundle for an older React DOM after the workspace dependencies had been aligned; clearing the cache fixed the runtime without changing the dependency set again.

**How to apply:** Confirm the actual resolved package versions first. If those match, clear only the affected app's generated Vite cache, restart its workflow, and verify the browser preview.
