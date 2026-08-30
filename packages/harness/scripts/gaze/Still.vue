<!-- The static half: no `animate`, so this renders an `<img>` and the
     composable must not start a driver on it. -->
<script setup>
import { ref } from "vue";
import { Blobatar } from "@blobatar/vue";
import { useGaze } from "@blobatar/vue/gaze";

const blob = ref();
useGaze(blob, { travel: 3, target: "pointer" });
</script>

<template>
  <Blobatar ref="blob" name="alain@example.com" :size="200" />
</template>
