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

**There is no `animate`.** Blobatar's idle motion is a stylesheet: `motion.css`,
a root class, and a dozen seeded custom properties the CSS reads. React Native
has none of the three. The prop is absent from the type rather than accepted and
ignored, so passing it is a compile error instead of a blobatar that silently
sits still.

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

### Reduced motion

Render `Blobatar` instead. This package imports no React Native module at all,
so it cannot read the setting itself, and your app already can:

```tsx
import { AccessibilityInfo } from "react-native";

const reduce = AccessibilityInfo.useReduceMotionEnabled();
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
