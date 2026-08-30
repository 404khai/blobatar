/**
 * `@blobatar/react/gaze`, mounted for `checks.js`.
 *
 * JSX, so that `<Blobatar ref={ref} />` is what is checked rather than the
 * `createElement` call it compiles to — the same reason every other fixture
 * here is written in its framework's own syntax. Bun's default transform is
 * React's, so this file needs no pragma; `preact.jsx` beside it does.
 */

import { useState } from "react";
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
    return <Blobatar ref={ref} name={name} animate="always" size={200} />;
  }

  /* The static half: no `animate`, so this is an `<img>` and the hook must not
     start a driver on it. */
  function StillHost() {
    const { ref } = useGaze({ travel: 3, lookAt: "pointer" });
    return <Blobatar ref={ref} name="alain@example.com" size={200} />;
  }

  /* `act` is deliberately not used: this page is built with
     `NODE_ENV=production`, which is what a consumer ships and where React
     exports no `act` at all. Rendering and then waiting a few frames is the
     same thing from outside, and it keeps the fixture honest about which build
     it is measuring. */
  const root = createRoot(container);
  root.render(<Host />);
  await settle(3);

  const still = document.createElement("div");
  container.after(still);
  const stillRoot = createRoot(still);
  stillRoot.render(<StillHost />);
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
