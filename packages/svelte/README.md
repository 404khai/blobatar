# @blobatar/svelte

Svelte adapter for [blobatar](https://github.com/Alain00/blobatar) — deterministic geometric avatars.

## Installation

```sh
bun add @blobatar/svelte blobatar
```

## Usage

```svelte
<script>
  import { Blobatar } from "@blobatar/svelte";
</script>

<Blobatar name="username" />
```

## Following the pointer

The eyes can track the cursor. That layer is the one part of the motion system
that needs JavaScript, so it is a separate subpath and costs nothing in your
bundle unless you import it:

```svelte
<script>
  import { Blobatar } from "@blobatar/svelte";
  import { gaze } from "@blobatar/svelte/gaze";
  import "blobatar/motion.css";
  import "blobatar/gaze.css"; // required — the eyes hold still without it

  const eyes = gaze({ travel: 3, target: "pointer" });
</script>

<Blobatar {@attach eyes} name="alain@example.com" animate="always" size={200} />
```

An attachment rather than an action, and it needs Svelte 5.29 or newer: an
action can only be written on the element it applies to, and the element here
belongs to `<Blobatar>`. Attachments cross that boundary, which is what makes
this a two-line integration instead of a reason to stop using the component.

`travel` is the excursion, and it is what opts a blobatar into the layer:
`--mo-track-travel` starts at `0px`, so a page with the stylesheet loaded and
the excursion set nowhere has a driver running and no eyes moving. It is in
viewBox units — the blobatar is 100 across, so `3` is 3% of the face — and
about 1.5 to 4 reads well. Leave it out and the stylesheet owns it instead,
which is the better route for a whole field of blobatars, since the property
inherits, or for anything responsive:

```css
.hero .mo-eyes { --mo-track-travel: 3px; }
```

Pick one, not both. `travel` is written inline on the eyes themselves, so here
it beats a rule like that one — the opposite of what the React hook does, and
for a Svelte-specific reason: Svelte rewrites the `<svg>`'s whole `style`
attribute whenever a prop changes, so a property written there would vanish the
first time the `name` did.

Everything in the options is read once, when the blobatar mounts. Aiming that
changes is `lookAt`, in an effect of your own:

```svelte
const eyes = gaze({ travel: 3 });
$effect(() => eyes.lookAt(watching ? "pointer" : "rest"));
```

Both take the same things: a point in client coordinates, an element
(`eyes.lookAt(button)`), `"pointer"` for the cursor, `"rest"` to park the eyes
in the middle without resuming the idle glance, or `null` for nothing, which
hands it back. The last thing asked for wins, whichever asked, and aiming
before the blobatar has mounted is remembered rather than dropped — so a caret
can be driven straight through `lookAt` with no re-render per keystroke.

Hold the result in a `const`. Calling `gaze()` inline in the template rebuilds
the driver whenever the state it reads changes, and a new driver starts with the
eyes at centre.

## What this package ships

Svelte, not JavaScript. A Svelte component only becomes renderable code inside
your compiler, so there is no build output here and none is invented — the
package is reachable through the `svelte` export condition, which every Svelte
toolchain applies (`vite-plugin-svelte`, SvelteKit, `svelte-check`). A bundler
configured without it will fail to resolve this package rather than hand you a
file it cannot execute.

Svelte 5 is required: the component is written with runes.

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
