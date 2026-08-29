/**
 * `@blobatar/vue/gaze`, mounted for `checks.js`.
 *
 * The components are SFCs so that `ref="blob"` goes through Vue's template
 * compiler; this module is the harness around them.
 */

import { createApp, h, ref } from "vue";
import Host from "./Host.vue";
import Still from "./Still.vue";
import { settle } from "./checks.js";

export async function mount(container) {
  const name = ref("alain@example.com");

  const app = createApp({ render: () => h(Host, { name: name.value }) });
  app.mount(container);
  await settle(2);

  const still = document.createElement("div");
  container.after(still);
  const stillApp = createApp(Still);
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
