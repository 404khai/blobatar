<!-- The static half: no `animate`, so this renders an `<img>` and the
     attachment must be inert on it. -->
<script>
  import { Blobatar } from "@blobatar/svelte";

  let { name, eyes } = $props();
</script>

<Blobatar {@attach eyes} {name} size={200} />
