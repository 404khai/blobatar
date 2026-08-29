/**
 * `@blobatar/svelte/gaze`, mounted for `checks.js`.
 *
 * `.svelte.js` rather than `.js` because the props are a `$state` proxy: check
 * D turns on a prop actually changing, and a plain object handed to `mount`
 * never does.
 *
 * `createAttachmentKey` is what `{@attach eyes}` compiles to on a component —
 * a prop under a symbol key — so this exercises the same path a template does.
 */

import { mount as mountComponent, unmount } from "svelte";
import { createAttachmentKey } from "svelte/attachments";
import { Blobatar } from "@blobatar/svelte";
import { gaze } from "@blobatar/svelte/gaze";
import { settle } from "./checks.js";

export async function mount(container) {
  const eyes = gaze({ travel: 3 });
  /* Aimed before there is anything to aim: the queued request is what makes a
     consumer's own `$effect(() => eyes.lookAt(…))` work, since it runs before
     the element exists and Svelte will not run it again on its own. */
  eyes.lookAt("pointer");

  const props = $state({
    name: "alain@example.com",
    animate: "always",
    size: 200,
    [createAttachmentKey()]: eyes,
  });
  const app = mountComponent(Blobatar, { target: container, props });
  await settle(2);

  const still = document.createElement("div");
  container.after(still);
  const stillEyes = gaze({ travel: 3, target: "pointer" });
  mountComponent(Blobatar, {
    target: still,
    props: {
      name: "alain@example.com",
      size: 200,
      [createAttachmentKey()]: stillEyes,
    },
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
