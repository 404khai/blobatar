# @blobatar/react-native

React Native and Expo adapter for [blobatar](https://github.com/Alain00/blobatar). Deterministic geometric avatars.

## Installation

```sh
bun add @blobatar/react-native blobatar
npx expo install react-native-svg     # or: bun add react-native-svg
```

`react-native-svg` is a peer dependency and is what actually draws. Every
blobatar is `<Path>` and `<Circle>` elements, no gradients, filters or masks.

Expo needs nothing else. An Expo app is a React Native app and `react-native-svg`
is the same library in both, so there is no `@blobatar/expo` package.

## Usage

```tsx
import { Blobatar } from "@blobatar/react-native";

function Avatar() {
  return <Blobatar name="username" size={48} />;
}
```

## Props

| Prop | Type | Description |
|------|------|-------------|
| `name` | `string` | **Required.** Who the blobatar is for. |
| `size` | `number` | **Required here.** Width and height in points. |
| `background` | `string \| false` | Background style. |
| `palette` | `Palette` | Color overrides. |
| `hue` | `number` | Pin the hue. |
| `tone` | `number` | Pin the tone. |
| `normalize` | `boolean` | Normalize the name. |
| `contrast` | `boolean` | Enforce the contrast guarantee. |
| `title` | `string` | Accessible label. |
| `expression` | `Expression` | Pose to render. |
| `animate` | `boolean` | **`AnimatedBlobatar` only**, from `@blobatar/react-native/animated`. Run the idle layer. Defaults to false. |
| `traits` | `TraitOverrides` | Override specific traits. |

Anything else lands on the underlying `<Svg>`, and wins over what the props
above derived.

## Two differences from the other adapters

Both are the platform rather than the package.

**`size` is required.** On the web, omitting it lets CSS size the element and
the viewBox scales to whatever the page decides. React Native has no such
fallback, so an unsized blobatar is a blank square. Defaulting it here was the
alternative, and an adapter that invents a default is an adapter that changes
the picture. The core is the only place a default is written down.

**Motion is three components, not a prop.** `Blobatar` is still, and stays the
cheapest thing this package can draw. `MorphingBlobatar` animates the change
between expressions. `AnimatedBlobatar` adds the idle layer on top. Each tier
is a separate export so a bundler drops the ones an app never names, and the
size gate holds all three apart.

`animate` therefore means something narrower here than on the web, where it
selects between `"hover"` and `"always"`. There is no hover on a touch screen,
so it is a boolean on `AnimatedBlobatar` and nothing else takes it. Passing it
to the other two is a compile error naming this package, which is the cheapest
place to learn the difference.

`expression` works in full. A static pose bakes into the geometry, which is why
it survives here for the same reason it survives in the string API. Setting a
new one cuts to it.

```tsx
import { happy } from "blobatar/expression";

<Blobatar name="username" size={48} expression={happy} />;
```

## Morphing between expressions

To animate the change from one expression to the next instead of cutting to it,
use `MorphingBlobatar`. It takes exactly the same props.

```tsx
import { MorphingBlobatar } from "@blobatar/react-native";
import { happy, sad } from "blobatar/expression";

<MorphingBlobatar name="username" size={48} expression={busy ? sad : happy} />;
```

It is 300ms adopting an expression and 400ms returning to idle, on the same
curve the web uses, and it interrupts cleanly: setting a new expression part way
through the last one starts from wherever the face actually is. Nothing animates
on mount.

**It is a second component rather than a `morph` prop**, and the reason is
bytes. The morph is about 1.1 kB gzipped, and a prop on one component is
reachable from that component whether or not anybody passes it, so every app
would carry it, including the grid of still avatars that is most of the usage.
As a separate export a bundler drops all of it for an app that never names it.

The idle layer is still absent, and this is not a step toward it. What moves
here is the pose, which is thirteen numbers on a state change you control. The
idle layer is six keyframe loops gated on `:hover`, and `:hover` has no meaning
on a touch screen.

## The idle layer

`AnimatedBlobatar` adds the ambient motion on top of the morph: breathe, bob,
blink, the glance, and the two loops that belong to an expression rather than to
the ambient layer, `thinking`'s seesaw and `mad`'s tremor.

```tsx
import { AnimatedBlobatar } from "@blobatar/react-native/animated";

// a profile header, one large avatar
<AnimatedBlobatar name="ada" size={120} animate />

// a grid: only what the list says is on screen
<AnimatedBlobatar name={u.id} size={44} animate={visible.has(u.id)} />
```

**`animate` is yours to drive, and that is the platform's doing.** On the web
the idle layer is gated on `:hover`, which is both the aesthetic answer and the
performance one. There is no hover on a touch screen; `motion.css` says so
itself, pausing every loop under `@media not ((hover: hover) and (pointer:
fine))`. So the only mode this platform has is the always-on one, and *when*
becomes a question your app can answer and a component drawn into a scroll view
cannot: screen focus, list viewability, a user setting.

It defaults to false, so an `AnimatedBlobatar` nobody has told to animate is a
still blobatar, exactly. Turning it on or off ramps over 400ms rather than
switching, which is the stylesheet's own transition.

**It runs on the UI thread.** The loops are Reanimated worklets, so a sidebar
full of agents all animating at once does not put a React render per blobatar
per frame on the JS thread. That is the case this is built for.

It is a separate entry point, `@blobatar/react-native/animated`, and that is
what keeps the dependency optional:

```sh
npm install react-native-reanimated react-native-worklets
```

Only this subpath needs them. `Blobatar` and `MorphingBlobatar` come from the
package root and link neither, so an app drawing still avatars in a list
installs no native animation library at all.

The cost is real and worth stating: the loops now exist twice, once in
`blobatar/idle` and once as worklets in the adapter, because a worklet cannot
call an imported function. `packages/harness` runs both over a wide sweep and
asserts they agree exactly, so a transcription error is a failing test rather
than something you notice on a device. The pose composition is deliberately
*not* duplicated: it stays in core and runs in JavaScript, since a morph is a
one-shot 300ms transition rather than a loop.

The seeded timings are the same ones the stylesheet reads, so a blobatar
breathes on the same offset on both platforms, and a grid of them is a crowd
rather than a heartbeat.

### Reduced motion

Pass `animate={!reduceMotion}`, or render `Blobatar` instead. This package
imports no React Native module at all, so it cannot read the setting itself,
and your app already can:

```tsx
import { AccessibilityInfo } from "react-native";

const reduce = AccessibilityInfo.useReduceMotionEnabled();

<AnimatedBlobatar name="username" size={48} expression={mood} animate={!reduce} />;

// or, to drop the morph as well
const C = reduce ? Blobatar : MorphingBlobatar;
<C name="username" size={48} expression={mood} />;
```

## Accessibility

`react-native-svg` has no `<title>`, so `title` becomes the accessibility label
on the root `<Svg>`: `accessible`, `accessibilityLabel` and
`accessibilityRole="image"`. Without one, the tree is hidden from screen readers
on both platforms, which is the same call `aria-hidden` makes on the web.

## License

MIT
