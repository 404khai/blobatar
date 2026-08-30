# @blobatar/react

## 2.7.0

### Patch Changes

- d62e6d0: Add `@blobatar/vue/gaze`, `@blobatar/solid/gaze` and `@blobatar/preact/gaze`. Every adapter can now reach the pointer-driven gaze layer, under the shape its framework reaches an element with.
  
  ```tsx
  const { ref } = useGaze({ travel: 3, lookAt: "pointer" });        // Preact
  <Blobatar elementRef={ref} name={user.email} animate="always" />;
  
  const eyes = createGaze({ travel: 3, target: "pointer" });        // Solid
  <Blobatar ref={eyes} name={user.email} animate="always" />;
  ```
  
  ```vue
  <script setup>
  const blob = ref();
  useGaze(blob, { travel: 3, target: "pointer" });                  // Vue
  </script>
  <template><Blobatar ref="blob" :name="user.email" animate="always" /></template>
  ```
  
  Four bindings and three shapes, because the frameworks disagree about how a caller reaches an element rather than about the layer. Preact's is React's hook, near-verbatim, since the two adapters are read side by side. Solid's is the ref itself — a function carrying the driver's seams, which a function can do because it is an object — and it needs no callback ref, no dependency array and no re-applied target, because a Solid component body runs once. Vue's takes the ref instead of handing one back, since a template ref is something the caller already owns, and reads `$el` off it because `<Blobatar>` is a component; the same call works on an `<svg>` of your own.
  
  Where React's hook takes `lookAt` declaratively — a construction-time option that looks declarative is a trap in something that re-renders — Vue's and Solid's keep the driver's own `target`, which is construction-time and says so. Aiming that changes goes through `lookAt` in a `watchEffect` or a `createEffect` of your own, and aiming before the blobatar has mounted is remembered rather than dropped, which is what makes those effects work at all.
  
  **Preact takes `elementRef`, not `ref`.** Preact pulls `ref` out of a function component's props before the component sees them and hands it the component's internal instance rather than a DOM node, so `<Blobatar ref={…}>` yields something with no `getBoundingClientRect` on it. The React-style behaviour lives in `preact/compat`, and importing compat would put it in the graph of every consumer, including the ones rendering a static list. So the adapter carries a second name for the same thing — 15 B on its row — and it lands on whichever element the mode renders. Solid needed no adapter change at all: a `ref` on a Solid component is an ordinary prop, and `<Blobatar>` already spreads what it does not read onto its element, where Solid's own `spread` calls it with the node.
  
  **`@blobatar/react/gaze` no longer starts a driver on a static blobatar.** With `animate` off the component renders an `<img>`, which has no eyes; the hook built a driver on it anyway, so a page that turned animation off kept a pointer listener and a frame loop running for a picture that could not move. It is inert there now, and `ref` accepts the `<img>` as well as the `<svg>` so that toggling `animate` is not a compile error.
  
  All four are checked in a real browser by `bun run probe` in `packages/harness` — six checks each, the same six. They are DOM plumbing this repository does not own (a symbol-keyed prop carried by a spread, a `ref` read out of a rest object, `$el` off a component instance, a callback ref Preact declines to give), none of it visible to a test that reads markup, and Svelte's does not run under `generate: "server"` at all. The React defect above is what that gate found on its first full run.

## 2.6.0

### Minor Changes

- 5163644: Add `@blobatar/react/gaze`: a `useGaze()` hook for the pointer-driven gaze layer.
  
  ```tsx
  import { Blobatar } from "@blobatar/react";
  import { useGaze } from "@blobatar/react/gaze";
  import "blobatar/gaze.css";
  
  const { ref } = useGaze({ travel: 3, lookAt: "pointer" });
  <Blobatar ref={ref} name={user.email} animate="always" size={200} />;
  ```
  
  `travel` is the excursion in viewBox units, and it is what opts a blobatar into the layer — `--mo-track-travel` starts at `0px`, so a page with the stylesheet loaded and the excursion set nowhere has a driver running and no eyes moving. Omit it and the stylesheet owns the property instead, which stays the better route for a whole field of blobatars (it inherits) or for anything responsive. Do not set both. The hook writes the property inline on the `<svg>` and `gaze.css` reads it on the `.mo-eyes` group inside, so a rule matching that group directly is a declaration on the element and beats the inherited inline value however it was written; the symptom is a face that renders perfectly and never moves. There is no default, so the two never collide unless you opt into both. The hook also remeasures after writing it, and that matters more than it looks: the driver caches the excursion as an angle as well as deriving its write threshold from it, so without the remeasure a changed `travel` would not reach the projection until the next scroll.
  
  A separate subpath rather than a prop on `<Blobatar>`, and the same bargain `@blobatar/react-native/animated` already makes: importing `Blobatar` links no pointer driver, so a consumer rendering static avatars in a list pays nothing. The adapter's own code is unchanged at 76 B gzipped; the hook is 351 B, and 2519 B with the driver it pulls in.
  
  `ref` is a callback ref, so the driver's life follows the element's exactly and a conditionally rendered blobatar detaches without anything needing a dependency array. `lookAt` and `remeasure` are stable across renders.
  
  A blobatar looks at nothing until it is aimed, `"pointer"` included. The `lookAt` **option** is where a component declares a target that does not change, which is most of them, and the returned `lookAt` **function** is for one that does — a caret, a card under the cursor, a step in a tour. Both take the driver's whole `GazeTarget` union, so a ref works where an element does (`lookAt(button.current)`) and `lookAt("rest")` parks the eyes in the middle without handing them back to the pointer. The option is re-applied whenever it changes and the function wins in between, so the two mix: declare the usual answer, call for the exceptions.
  
  `GazeOptions.target` is not forwarded under its own name, because on the driver it is construction-time sugar read once, and a construction-time option that looks declarative is the classic React trap. The `lookAt` option is applied on mount and on every change, which is the declarative thing it looks like. Aiming before the blobatar mounts is a queued request rather than a no-op either way: the hook holds the last target asked for and hands it to the driver as it builds it, which also means retuning `settle` or `snap` — which does rebuild the driver — no longer quietly stops the gaze.

## 2.5.0

## 2.4.0

## 2.3.1

### Patch Changes

- Document the shadcn/ui registry item, and add `shadcn` keywords so the packages
  are findable from that side.
  
  No runtime change: the READMEs and the `keywords` arrays are the whole diff.
  This is a release because an npm package page is written by a publish and by
  nothing else, so the registry item stays invisible on the two pages most likely
  to be read until one happens.

## 2.3.0

## 2.2.0

### Minor Changes

- 011915a: Adapters are published under their own names: **`@blobatar/react`** and **`@blobatar/vue`**.
  
  Nothing breaks. `blobatar/react` and `blobatar/vue` keep working and render exactly what they always did — the new packages re-export them, so they are the same component and cannot drift. Move when it suits you:
  
  ```sh
  bunx blobatar-codemod .
  bun add @blobatar/react
  ```
  
  The old subpaths are deprecated and frozen, and go in v3. They are also the last two: adapters added from here on are packages only, so `blobatar`'s optional peer list stops growing at `react` and `vue` instead of naming every framework the library ever supports.
  
  Also new: `blobatar/internal` (`_parts`, `_layout`, `serializeVars`), the entry point adapters build against. Its shape changes only on a major, together with every `@blobatar/*` package. It is not a general-purpose API — `blobatar()` and `blobatarUri()` remain the public answers for rendering markup.
  
  No blobatar changes. Faces are byte-identical to the previous release.
