# @blobatar/solid

## 2.7.0

### Minor Changes

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

### Patch Changes

- 6e900d9: Fix the Solid adapter rebuilding its `<svg>` on every prop change, and finish documenting the gaze bindings.
  
  The branch between the two rendering modes was a ternary inside a dynamic child expression, which Solid compiles to one computation: it re-ran whenever anything it read changed — a new `name`, a new `hue`, a new size — and re-running it built a fresh element and swapped it in. That is the failure the comment inside the `<svg>` is about, one level up. A fresh element has no previous computed value, so every idle animation under it restarted from phase zero on any prop change, and anything holding the old element — a gaze driver, most obviously — was left measuring a node that had left the document. It was the only adapter that did this; React, Preact, Vue and Svelte all keep the element and update its attributes.
  
  It is a non-keyed `<Show>` now, which memoizes on the condition rather than on the value, so the branch is built once and stays while `parts()` keeps returning something. Everything inside is an ordinary reactive attribute updated in place. 19 B on the adapter's row.
  
  `packages/harness/scripts/probe-gaze.ts` grew the check that would have caught it, asked of every adapter: the `<svg>` a binding was given is still the same element after a prop change. Checked by identity, which is the only way to see it, since the rebuilt element renders identically.
  
  The same defect showed on the hydrated path, where it is worse: a server-rendered blobatar was adopted correctly and then thrown away on the first prop change. `packages/harness/scripts/probe-gaze.ts` now hydrates the SSR build's markup with the DOM build and checks both halves — that the client adopts the server's element rather than silently rebuilding it, that the gaze `ref` fires on a hydrated tree, and that a later prop change redraws in place. Nothing tested hydration before, in either direction.
  
  `packages/blobatar/README.md` and the site's docs page still described the gaze as React's alone. Both now name all five bindings.
  
  The probe's fixtures are written in each framework's own source syntax now — a `.svelte` component using `{@attach eyes}`, a `.vue` SFC with `ref="blob"` in the template, Solid JSX with `<Blobatar ref={eyes} />`, Preact JSX behind its own `jsxImportSource` — and compiled by that framework's own compiler. They were the calls those lines compile to, which is the correct target and checks the chain each one starts, but left the line a consumer copies out of a README unchecked. It also got one thing wrong that nothing else could see: a hand-written component call opens no component boundary, and Solid numbers its hydration keys against those, which made the hydration fixture fail for a reason that was the probe's rather than the adapter's. No new dependency but Solid's transform: Svelte's compiler ships with Svelte and Vue's with Vue.

## 2.6.0

## 2.5.0

## 2.4.0

## 2.3.1

## 2.3.0

### Minor Changes

- a5fd112: Add Svelte, Solid, and Preact adapters
  
  Three new framework adapters, each its own package under ADR-0009 — its own
  build, its own peers, and its own row in `packages/harness`.
  
  Each holds a real component written in its framework's own idiom and compiled
  by its framework's own transform, which is what splitting the packages bought:
  `@blobatar/preact` against `preact/jsx-runtime`, `@blobatar/solid` through
  `babel-preset-solid` (emitting a DOM build, an SSR build, and JSX source for
  consumers running `vite-plugin-solid`), and `@blobatar/svelte` as a Svelte
  component the consumer's own compiler builds.
  
  `@blobatar/svelte` publishes source rather than a `dist` and is reachable only
  through the `svelte` export condition — see ADR-0010.
  
  All three peer-depend on `blobatar` with an exact major range (`2.x`) plus their
  own framework peer, read `_parts` from `blobatar/internal` and `blobatarUri`
  from `blobatar/uri`, and support both rendering modes.
