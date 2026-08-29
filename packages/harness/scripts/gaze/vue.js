/**
 * `@blobatar/vue/gaze`, mounted for `checks.js`.
 *
 * `h()` and a render function rather than an SFC, so the probe needs no
 * template compiler — and `ref: blob` in the vnode's props is exactly what
 * `ref="blob"` compiles to in a template, so what the composable receives here
 * is what it receives there: the component's public instance, not an element.
 */

import { createApp, h, ref } from "vue";
import { Blobatar } from "@blobatar/vue";
import { useGaze } from "@blobatar/vue/gaze";
import { settle } from "./checks.js";

export async function mount(container) {
  const name = ref("alain@example.com");
  const blob = ref();

  const app = createApp({
    setup() {
      /* Aimed before there is anything to aim at: the queued request is what
         makes a `watchEffect(() => lookAt(…))` in a consumer's own setup work,
         since it runs before the element exists. */
      const { lookAt } = useGaze(blob, { travel: 3 });
      lookAt("pointer");
      return () =>
        h(Blobatar, { ref: blob, name: name.value, animate: "always", size: 200 });
    },
  });
  app.mount(container);
  await settle(2);

  const still = document.createElement("div");
  container.after(still);
  const stillApp = createApp({
    setup() {
      const el = ref();
      useGaze(el, { travel: 3, target: "pointer" });
      return () => h(Blobatar, { ref: el, name: "alain@example.com", size: 200 });
    },
  });
  stillApp.mount(still);
  await settle(2);

  return {
    container,
    svg: container.querySelector("svg"),
    img: still.querySelector("img"),
    rename: async (n) => {
      name.value = n;
      await settle(2);
    },
    unmount: async () => {
      app.unmount();
      await settle(2);
    },
  };
}
