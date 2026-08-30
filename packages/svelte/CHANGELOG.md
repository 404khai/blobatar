# @blobatar/svelte

## 2.7.0

### Minor Changes

- 2143c88: Add `@blobatar/svelte/gaze`: the pointer-driven gaze layer as an attachment.
  
  ```svelte
  <script>
    import { Blobatar } from "@blobatar/svelte";
    import { gaze } from "@blobatar/svelte/gaze";
    import "blobatar/gaze.css";
  
    const eyes = gaze({ travel: 3, target: "pointer" });
  </script>
  
  <Blobatar {@attach eyes} name={user.email} animate="always" size={200} />
  ```
  
  Until now this adapter could not reach the gaze at all, and not because the layer was missing: Svelte's two ways of reaching an element from outside the component that renders it are `bind:this` and `use:`, and neither crosses a component boundary — the first yields the component's exports rather than its DOM, and an action can only be written on the element it applies to. So a Svelte consumer who wanted the eyes to follow the cursor had to stop using `<Blobatar>` and render the markup themselves. `{@attach …}` on a component is a prop under a symbol key, and `Blobatar.svelte` already spread `{...rest}` onto its element, so this reaches the `<svg>` with no change to the component. Attachments arrived in Svelte 5.29; the package still peers `svelte: ">=5"`, because a range is per package rather than per subpath and narrowing it would refuse installs for consumers of `Blobatar` alone.
  
  `travel` is the excursion in viewBox units, and it is what opts a blobatar into the layer — `--mo-track-travel` starts at `0px`, so a page with the stylesheet loaded and the excursion set nowhere has a driver running and no eyes moving. Omit it and the stylesheet owns the property instead, which stays the better route for a whole field of blobatars (it inherits) or for anything responsive. Do not set both: unlike the React hook, `travel` here beats a rule on `.mo-eyes` rather than losing to one, because it is written on that element rather than inherited from the `<svg>`. That is not a preference. Svelte rewrites the `<svg>`'s whole `style` attribute whenever a prop changes, so a property written where the React hook writes it survived until the first `name` change and then silently vanished, leaving a blobatar that renders perfectly and no longer moves. It is written where `gaze.css` reads it and where the driver reads it back, which is also the only place the excursion and the driver's write threshold cannot disagree.
  
  Everything in the options is read once, at mount, so `target` keeps the driver's own name for the driver's own construction-time option rather than being renamed to something that would promise more. Aiming that changes is `lookAt` on the returned attachment, wrapped in an effect of your own — `$effect(() => eyes.lookAt(watching ? "pointer" : "rest"))` — and aiming before the blobatar mounts is remembered rather than dropped, which is what makes that effect work at all. The last thing asked for wins, whichever asked, so a caret can be driven straight through `lookAt` with no render per keystroke.
  
  A subpath rather than a prop, the same bargain `@blobatar/react/gaze` makes: `index.js` names nothing in `gaze.js`, so a consumer rendering static avatars in a list bundles no pointer driver. On the wire the tarball carries both entries — this package publishes source — and the ship gate's row moves from 2613 B to 5281 B gzipped to say so.
  
  Checked in a real browser (`bun run probe` in `packages/harness`), because an attachment does not run under `generate: "server"` and the existing suite renders Svelte that way: a binding that never reached an element would have passed every test in this repository.

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
