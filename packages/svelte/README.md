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
