# @blobatar/solid

Solid adapter for [blobatar](https://github.com/Alain00/blobatar) — deterministic geometric avatars.

## Installation

```sh
bun add @blobatar/solid blobatar
```

## Usage

```tsx
import { Blobatar } from "@blobatar/solid";

function App() {
  return <Blobatar name="username" />;
}
```

## Following the pointer

The eyes can track the cursor. That layer is the one part of the motion system
that needs JavaScript, so it is a separate subpath and costs nothing unless you
import it:

```tsx
import { Blobatar } from "@blobatar/solid";
import { createGaze } from "@blobatar/solid/gaze";
import "blobatar/motion.css";
import "blobatar/gaze.css"; // required — the eyes hold still without it

const eyes = createGaze({ travel: 3, target: "pointer" });
<Blobatar ref={eyes} name={user.email} animate="always" size={200} />;
```

The whole binding is the ref: a function with the driver's seams hung off it,
which a function can carry because it is an object. Solid does not re-render, so
there is no callback ref to keep and no dependency array to key on — the
component body runs once and so does this.

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

Everything in the options is read once. Aiming that changes is `lookAt`, in an
effect of your own:

```tsx
const eyes = createGaze({ travel: 3 });
createEffect(() => eyes.lookAt(watching() ? "pointer" : "rest"));
```

Both take the same things: a point in client coordinates, an element
(`eyes.lookAt(button)`), `"pointer"` for the cursor, `"rest"` to park the eyes in
the middle without resuming the idle glance, or `null` for nothing, which hands
it back. The last thing asked for wins, whichever asked, and aiming before the
blobatar has mounted is remembered rather than dropped — so a caret can be driven
straight through `lookAt` with no re-render per keystroke.

## What this package ships

Three builds, picked by your toolchain: JSX source behind the `solid` condition
for anything running `vite-plugin-solid`, an SSR build under `node`, and a DOM
build by default. Solid compiles differently per target rather than branching at
runtime, so a consumer handed the wrong one renders nothing — the conditions are
what keep that from happening.

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

## License

MIT
