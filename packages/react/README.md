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

## Following the pointer

The eyes can track the cursor. That layer is the one part of the motion system
that needs JavaScript, so it is a separate subpath and costs nothing unless you
import it:

```tsx
import { Blobatar } from "@blobatar/react";
import { useGaze } from "@blobatar/react/gaze";
import "blobatar/motion.css";
import "blobatar/gaze.css"; // required — the eyes hold still without it

const { ref } = useGaze({ travel: 3 });
<Blobatar ref={ref} name={user.email} animate="always" size={200} />;
```

`travel` is the excursion, and it is what opts a blobatar into the layer:
`--mo-track-travel` starts at `0px`, so a page with the stylesheet loaded and
the excursion set nowhere has a driver running and no eyes moving. It is in
viewBox units — the blobatar is 100 across, so `3` is 3% of the face — and
about 1.5 to 4 reads well.

Leave it out and the stylesheet owns it instead, which is the better route for a
whole field of blobatars, since the property inherits, or for anything
responsive:

```css
.hero .mo-eyes { --mo-track-travel: 3px; }
```

Pick one, not both. A rule like that one wins over `travel`, not the other way
round: the hook writes the property inline on the `<svg>` and the eyes inherit
it from there, and a declaration on the element itself always beats an inherited
value however that value was written. Set both and the rule is what you get,
silently, and the symptom is a face that renders perfectly and never moves.
There is no default, so the two never collide unless you opt into both.

A blobatar looks at nothing until it is aimed, `"pointer"` included. Where that
never changes, say so in the options and there is nothing else to write:

```tsx
const { ref } = useGaze({ travel: 3, lookAt: "pointer" });
```

`lookAt` is also handed back for aiming that does change, and both take the same
things: a point in client coordinates, an element (`lookAt(button.current)`),
`"pointer"` for the cursor, `"rest"` to park the eyes in the middle without
resuming it, or `null` for nothing, which gives the blobatar its idle glance
back. The option is re-applied whenever it changes and the function wins in
between, so a component can declare its usual target and still aim by hand.
`lookAt` and `remeasure` are stable across renders. `useGaze({ settle, snap })`
tunes the pursuit.

Nothing attaches under `prefers-reduced-motion` or without a fine pointer, and
both are watched rather than sampled once. This is a large-size effect: on a
40px avatar it is a fraction of a pixel, and it earns its place on the one big
blobatar a page is about.

## With shadcn/ui

There is a registry item that composes this adapter with shadcn's `Avatar`,
falling back to a blobatar when a user has no profile image:

```sh
npx shadcn@latest registry add @blobatar=https://blobatar.dev/r/{name}.json
npx shadcn@latest add @blobatar/avatar
```

```tsx
import { Blobatar } from "@/components/ui/blobatar";

<Blobatar name={user.email} src={user.avatarUrl} />;
```

That `Blobatar` is the wrapper, not this one — it takes a `src` alongside the
`name`, and every option above goes in a `blobatar` prop. `shadcn add` installs
this package for it, so a project using both imports one of the two under
another name.

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
