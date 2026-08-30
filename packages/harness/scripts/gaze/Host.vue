<!--
  The Vue fixture's component, written the way `@blobatar/vue`'s README says to
  write it: a template ref named in the template, handed to `useGaze` in
  `<script setup>`, compiled by `vue/compiler-sfc`.

  That is the whole reason this is an SFC rather than an `h()` call. What
  `ref="blob"` yields is the component's public instance, and the composable
  reads `$el` off it — a chain that only exists once a template compiler has run
  over the attribute, so a fixture writing `h(Blobatar, { ref: blob })` checked
  what that compiles to while leaving the compilation unchecked.
-->
<script setup>
import { ref } from "vue";
import { Blobatar } from "@blobatar/vue";
import { useGaze } from "@blobatar/vue/gaze";

const props = defineProps({ name: String });

const blob = ref();
const { lookAt } = useGaze(blob, { travel: 3 });
/* Aimed before there is anything to aim at: the queued request is what makes a
   consumer's own `watchEffect(() => lookAt(…))` work, since it runs before the
   element exists. */
lookAt("pointer");
</script>

<template>
  <Blobatar ref="blob" :name="props.name" animate="always" :size="200" />
</template>
