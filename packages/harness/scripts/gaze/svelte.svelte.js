/**
 * `@blobatar/svelte/gaze`, mounted for `checks.js`.
 *
 * The component lives in `Host.svelte` so that `{@attach eyes}` goes through
 * the Svelte compiler rather than being hand-written as the symbol-keyed prop
 * it compiles to. This module is the harness around it, and is `.svelte.js`
 * because the props it hands over are a `$state` proxy: check F turns on a prop
 * actually changing, and a plain object handed to `mount` never does.
 */

import { mount as mountComponent, unmount } from "svelte";
import { gaze } from "@blobatar/svelte/gaze";
import Host from "./Host.svelte";
import Still from "./Still.svelte";
import { settle } from "./checks.js";

export async function mount(container) {
  const eyes = gaze({ travel: 3 });
  /* Aimed before there is anything to aim: the queued request is what makes a
     consumer's own `$effect(() => eyes.lookAt(…))` work, since it runs before
     the element exists and Svelte will not run it again on its own. */
  eyes.lookAt("pointer");

  const props = $state({ name: "alain@example.com", eyes });
  const app = mountComponent(Host, { target: container, props });
  await settle(2);

  const still = document.createElement("div");
  container.after(still);
  mountComponent(Still, {
    target: still,
    props: { name: "alain@example.com", eyes: gaze({ travel: 3, target: "pointer" }) },
  });
  await settle(2);

  return {
    container,
    svg: container.querySelector("svg"),
    img: still.querySelector("img"),
    rename: async (n) => {
      props.name = n;
      await settle(2);
    },
    unmount: async () => {
      unmount(app);
      await settle(2);
    },
  };
}
