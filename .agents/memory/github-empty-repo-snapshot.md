---
name: GitHub empty-repository snapshot uploads
description: Distinguishes a normal Git push from an API snapshot and records empty-repository initialization behavior.
---

Prefer a normal Git push because it preserves branch history. On an empty GitHub repository, Git Database API writes may return 409 until a first commit exists. An API snapshot is not equivalent to `git push` and should only be used with the user's explicit approval; seed a tracked file through the Contents API, then add the full project tree and advance the branch.

**Why:** In this workspace, the GitHub API connection worked while HTTPS and SSH Git transport authentication failed, and Git Database writes rejected the empty repository.

**How to apply:** Verify Git transport and repository state before publishing. If the user chooses an API snapshot fallback, explain that local commit history will not be included, initialize the remote, and verify privacy, branch ref, and the expected file set.
