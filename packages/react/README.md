# @blobatar/react

React adapter for [blobatar](https://github.com/Alain00/blobatar) — deterministic
geometric avatars generated from any string.

```sh
bun add @blobatar/react blobatar
```

`blobatar` is a peer dependency: the adapter carries no renderer of its own.

```tsx
import { Blobatar } from "@blobatar/react";

<Blobatar name={user.email} size={48} />
```

Animated blobatars need the stylesheet, and render as inline SVG rather than an
`<img>` — `:hover` never fires inside an `<img>`, so the two modes cannot be
combined:

```tsx
import "blobatar/motion.css";

<Blobatar name={user.email} animate="hover" />
```

Full option reference lives in the [main README](https://github.com/Alain00/blobatar#readme).

## Versioning

Every package in the set publishes the same version, and the major names the
**generation** — the frozen seed-to-look mapping. `@blobatar/react@2` renders
gen2, exactly as `blobatar@2` does. Upgrading a major is the opt-in to your
users' avatars changing, so the peer range on `blobatar` is an exact major
rather than `^`: a mixed pair is not a version skew, it is the wrong picture.

## Coming from `blobatar/react`

`blobatar/react` still exists and still works. This package re-exports it, so the
two are the same component rather than two copies and cannot drift. That subpath
is deprecated and is removed in v3 — there is no hurry, and no risk in waiting.

```sh
bunx blobatar-codemod .
bun add @blobatar/react
```

The codemod rewrites every `blobatar/react` specifier it finds, in imports,
`require`, dynamic `import()` and prose, and is safe to run twice. It does not
install anything; that command is yours.
