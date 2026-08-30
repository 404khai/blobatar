# @blobatar/preact

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
