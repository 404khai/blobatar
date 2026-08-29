/**
 * `@blobatar/react/gaze`, mounted for `checks.js`.
 *
 * `createElement` rather than JSX, here and in every fixture that has one, so
 * the probe's build needs no transform beyond the Svelte compiler it already
 * carries — and so the four fixtures read as the same file four times.
 */

import { createElement as h, useState } from "react";
import { createRoot } from "react-dom/client";
import { Blobatar } from "@blobatar/react";
import { useGaze } from "@blobatar/react/gaze";
import { settle } from "./checks.js";

export async function mount(container) {
  let rename;

  function Host() {
    const [name, setName] = useState("alain@example.com");
    rename = setName;
    /* The declared target rather than a `lookAt` call: in a hook that is the
       route a consumer writes, and it is applied on the render the blobatar
       first appears on. */
    const { ref } = useGaze({ travel: 3, lookAt: "pointer" });
    return h(Blobatar, { ref, name, animate: "always", size: 200 });
  }

  /* `act` is deliberately not used: this page is built with
     `NODE_ENV=production`, which is what a consumer ships and where React
     exports no `act` at all. Rendering and then waiting a few frames is the
     same thing from outside, and it keeps the fixture honest about which build
     it is measuring. */
  const root = createRoot(container);
  root.render(h(Host));
  await settle(3);

  const still = document.createElement("div");
  container.after(still);
  const stillRoot = createRoot(still);
  const StillHost = () => {
    const { ref } = useGaze({ travel: 3, lookAt: "pointer" });
    return h(Blobatar, { ref, name: "alain@example.com", size: 200 });
  };
  stillRoot.render(h(StillHost));
  await settle(3);

  return {
    container,
    svg: container.querySelector("svg"),
    img: still.querySelector("img"),
    rename: async (n) => {
      rename(n);
      await settle(3);
    },
    unmount: async () => {
      root.unmount();
      await settle(3);
    },
  };
}
