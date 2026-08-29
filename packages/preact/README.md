# @blobatar/preact

Preact adapter for [blobatar](https://github.com/Alain00/blobatar) — deterministic geometric avatars.

## Installation

```sh
bun add @blobatar/preact blobatar
```

## Usage

```tsx
import { Blobatar } from "@blobatar/preact";

function App() {
  return <Blobatar name="username" />;
}
```

## Following the pointer

The eyes can track the cursor. That layer is the one part of the motion system
that needs JavaScript, so it is a separate subpath and costs nothing unless you
import it:

```tsx
import { Blobatar } from "@blobatar/preact";
import { useGaze } from "@blobatar/preact/gaze";
import "blobatar/motion.css";
import "blobatar/gaze.css"; // required — the eyes hold still without it

const { ref } = useGaze({ travel: 3, lookAt: "pointer" });
<Blobatar elementRef={ref} name={user.email} animate="always" size={200} />;
```

`elementRef`, not `ref`, and it is the one place this adapter reads differently
from `@blobatar/react`. Preact takes `ref` out of a function component's props
before the component sees them and hands it the component's internal instance
rather than any DOM node; the React-style behaviour lives in `preact/compat`, and
importing compat here would put it in the graph of every consumer, including the
ones rendering a static list. So the adapter carries a second name for the same
thing, and it lands on whichever element the mode renders.

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

Pick one, not both. A rule like that one wins over `travel`, since the hook
writes the property inline on the element and the eyes inherit it from there.

`lookAt` is declared in the options where the answer never changes, and handed
back for aiming that does. Both take the same things: a point in client
coordinates, an element, `"pointer"` for the cursor, `"rest"` to park the eyes in
the middle without resuming the idle glance, or `null` for nothing, which hands
it back. The option is re-applied whenever it changes and the function wins in
between, so a caret can be driven straight through `lookAt` with no render per
keystroke. `lookAt` and `remeasure` are stable across renders.

## Props

| Prop | Type | Description |
|------|------|-------------|
| `name` | `string` | **Required.** Who the blobatar is for. |
| `size` | `number` | Width and height in pixels. |
| `animate` | `"always" \| "hover"` | Enable animation. |
| `background` | `string \| false` | Background style. |
| `palette` | `string[]` | Color palette. |
| `hue` | `number` | Pin the hue. |
| `tone` | `number` | Pin the tone. |
| `normalize` | `boolean` | Normalize the name. |
| `contrast` | `boolean` | Enable contrast. |
| `title` | `string` | Accessible title. |
| `expression` | `Expression` | Expression to render. |
| `traits` | `TraitOverrides` | Override specific traits. |
| `elementRef` | `(el) => void` | A ref to the rendered element. React's `ref`, under the only name Preact leaves available. |

## License

MIT
