<!--
  The Svelte fixture's component, written the way `@blobatar/svelte`'s README
  says to write it: `{@attach eyes}` on the component, in a template, compiled
  by the Svelte compiler.

  That is the whole reason this file exists rather than a `createAttachmentKey`
  call in JavaScript. The key is what `{@attach}` compiles to, so a fixture that
  wrote it by hand checked the mechanism while leaving the syntax a consumer
  actually types untested — and the syntax is the part a version of Svelte could
  change under us.
-->
<script>
  import { Blobatar } from "@blobatar/svelte";

  let { name, eyes } = $props();
</script>

<Blobatar {@attach eyes} {name} animate="always" size={200} />
