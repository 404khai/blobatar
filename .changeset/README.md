# Changesets

Release tooling for the workspace. `bunx changeset` records an intended version
bump; `changeset version` applies every recorded one and writes the changelogs.

## Why `fixed`, and what it is protecting

`fixed` is the whole reason this directory exists, and it is not a preference.

ADR-0008 makes the package major the library's **generation** selector:
`blobatar@1` renders gen1, `blobatar@2` renders gen2. That reading survives the
split into `blobatar` plus `@blobatar/*` adapters only if every package in the
set carries the same version — otherwise `@blobatar/svelte@3` would be a claim
about the adapter's own API and `blobatar@3` a claim about the generation, and
nothing would tell a reader which of the two majors in their lockfile answered
"which faces am I getting?".

Under `fixed`, one changeset releases the set and every package lands on the
same number. An adapter takes a major when the generation moves even though its
own code did not, and that is correct rather than noise: an adapter re-expresses
the library and adds nothing to it, so it has no semantics of its own to
version. Its version is the library's version.

**`fixed` is empty right now, and turning it on is a required step of the next
PR — not an optional tidy-up.** Changesets validates the group against packages
that actually exist and rejects a glob matching none, so `[["blobatar",
"@blobatar/*"]]` cannot be committed until the first adapter package does. It
goes in the same commit that creates `packages/react`, and until then this file
is the only record that it has to.

There is no tooling that will remind anyone. A workspace that grows a second
publishable package while `fixed` is still `[]` will release it on its own
version line, and the first sign of that is a consumer with two different
majors in a lockfile.

## The other half of the guarantee

`fixed` keeps the published versions in step. It does **not** stop a consumer
from installing them out of step, because npm resolves each package on its own.
That is why every adapter pins core with an exact-major range — `"blobatar":
"2.x"`, never `^2`. Without it, `@blobatar/react@3` alongside `blobatar@2`
installs cleanly and renders last generation's faces from a package the consumer
believes is current.

`release.yml` asserts the same thing a second time, from the other side: it
refuses to publish when any package's version disagrees with the tag.

## Running it

The CLI is interactive and does not run under `bunx` cleanly, so it is invoked
through Node:

```sh
bun run changeset          # record a bump
bun run changeset:status   # what would be released
```
