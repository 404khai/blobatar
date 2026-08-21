# @blobatar/cli

What changed, and — where it matters — what it costs to upgrade.

The library's changelog states churn in the seed → look mapping; this one
never will, because the CLI does not own a mapping. It renders through the
published package majors — `--gen` pins one — so faces move only when your
lockfile moves a blobatar major, never on a CLI release.

Versions are the library's, not this package's: `@blobatar/cli` is in lockstep
with `blobatar` and every `@blobatar/*` (see CONTEXT.md), so a release here
carries the group's number and a release there carries this package along.
