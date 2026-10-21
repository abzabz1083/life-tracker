---
name: GitHub empty-repository snapshot uploads
description: Distinguishes a normal Git push from an API snapshot and records empty-repository initialization behavior.
---

Prefer a normal Git push because it preserves branch history. On an empty GitHub repository, Git Database API writes may return 409 until a first commit exists. An API snapshot is not equivalent to `git push` and should only be used with the user's explicit approval; seed a tracked file through the Contents API, then add the full project tree and advance the branch.

**Why:** In this workspace, the GitHub API connection worked while HTTPS and SSH Git transport authentication failed, and Git Database writes rejected the empty repository.

**How to apply:** Verify Git transport and repository state before publishing. If the user chooses an API snapshot fallback, explain that local commit history will not be included, initialize the remote, and verify privacy, branch ref, and the expected file set.

Treat Git source-control attachment and GitHub API connector attachment as separate checks; an “active” source-control connection does not prove that Git authentication works.

**Why:** The source-control attachment reported success while Git rejected its credentials, the source-control connection was unavailable through the API proxy, and attaching a separate GitHub API connection was blocked by an existing assignment.

**How to apply:** Verify transport with a read-only Git request and verify API access separately. Do not repeatedly reopen connection prompts or push to the old owner when the requested account cannot be verified; report the connection conflict and leave repositories unchanged.

For shell-based pushes, an interactive GitHub CLI browser login followed by `gh auth setup-git` can resolve authentication even when the Replit connection UI already says connected.

**Why:** Repeated integration reconnections did not authenticate shell Git; completing the CLI browser authorization and configuring its credential helper enabled the normal history-preserving push.

**How to apply:** Verify the authenticated username with `gh api user` before configuring Git. Have the user complete browser authorization in their Shell, never share tokens in chat. A push can succeed remotely but exit with a local tracking-reference permission error; compare the remote branch SHA before retrying. Use the documented Git permission override only for authorized local Git writes.
