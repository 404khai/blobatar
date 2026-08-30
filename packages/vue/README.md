# @blobatar/vue

Vue 3 adapter for [blobatar](https://github.com/Alain00/blobatar) — deterministic
geometric avatars generated from any string.

```sh
bun add @blobatar/vue blobatar
```

`blobatar` is a peer dependency: the adapter carries no renderer of its own.

```vue
<script setup lang="ts">
import { Blobatar } from "@blobatar/vue";
</script>

<template>
  <Blobatar :name="user.email" :size="48" />
</template>
```

Animated blobatars need the stylesheet, and render as inline SVG rather than an
`<img>` — `:hover` never fires inside an `<img>`, so the two modes cannot be
combined:

```vue
<script setup lang="ts">
import "blobatar/motion.css";
</script>

<template>
  <Blobatar :name="user.email" animate="hover" />
</template>
```

Full option reference lives in the [main README](https://github.com/Alain00/blobatar#readme).

## Following the pointer

The eyes can track the cursor. That layer is the one part of the motion system
that needs JavaScript, so it is a separate subpath and costs nothing unless you
import it:

```vue
<script setup lang="ts">
import { ref } from "vue";
import { Blobatar } from "@blobatar/vue";
import { useGaze } from "@blobatar/vue/gaze";
import "blobatar/motion.css";
import "blobatar/gaze.css"; // required — the eyes hold still without it

const blob = ref();
useGaze(blob, { travel: 3, target: "pointer" });
</script>

<template>
  <Blobatar ref="blob" :name="user.email" animate="always" :size="200" />
</template>
```

It takes the ref rather than handing one back, because in Vue you already own
it. What the ref holds is the component instance rather than an element, and the
composable reads `$el` off it — so the same call works if you put the ref on an
`<svg>` of your own instead.

`travel` is the excursion, and it is what opts a blobatar into the layer:
`--mo-track-travel` starts at `0px`, so a page with the stylesheet loaded and
the excursion set nowhere has a driver running and no eyes moving. It is in
viewBox units — the blobatar is 100 across, so `3` is 3% of the face — and about
1.5 to 4 reads well. Leave it out and the stylesheet owns it instead, which is
the better route for a whole field of blobatars, since the property inherits, or
for anything responsive:

```css
.hero .mo-eyes { --mo-track-travel: 3px; }
```

Pick one, not both. A rule like that one wins over `travel`, since the option is
written inline on the `<svg>` and reaches the eyes by inheritance.

Everything in the options is read once, when the element arrives. Aiming that
changes is `lookAt`, in a watcher of your own:

```ts
const { lookAt } = useGaze(blob, { travel: 3 });
watchEffect(() => lookAt(watching.value ? "pointer" : "rest"));
```

Both take the same things: a point in client coordinates, an element, `"pointer"`
for the cursor, `"rest"` to park the eyes in the middle without resuming the idle
glance, or `null` for nothing, which hands it back. The last thing asked for
wins, whichever asked, and aiming before the blobatar has mounted is remembered
rather than dropped — so a caret can be driven straight through `lookAt` with no
re-render per keystroke.

## Versioning

Every package in the set publishes the same version, and the major names the
**generation** — the frozen seed-to-look mapping. `@blobatar/vue@2` renders
gen2, exactly as `blobatar@2` does. Upgrading a major is the opt-in to your
users' avatars changing, so the peer range on `blobatar` is an exact major
rather than `^`: a mixed pair is not a version skew, it is the wrong picture.

## Coming from `blobatar/vue`

`blobatar/vue` still exists and still works. This package re-exports it, so the
two are the same component rather than two copies and cannot drift. That subpath
is deprecated and is removed in v3 — there is no hurry, and no risk in waiting.

```sh
bunx blobatar-codemod .
bun add @blobatar/vue
```

The codemod rewrites every `blobatar/vue` specifier it finds, in imports,
`require`, dynamic `import()` and prose, and is safe to run twice. It does not
install anything; that command is yours.
