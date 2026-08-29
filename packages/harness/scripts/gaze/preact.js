/**
 * `@blobatar/preact/gaze`, mounted for `checks.js`.
 *
 * The one line that differs from `react.js` is the one that matters:
 * `elementRef` rather than `ref`, because Preact pulls `ref` out of a function
 * component's props before the component sees them. A probe that quietly used
 * `ref` here would pass every check while telling a consumer to write something
 * that cannot work.
 */

import { createElement as h, render } from "preact";
import { useState } from "preact/hooks";
import { Blobatar } from "@blobatar/preact";
import { useGaze } from "@blobatar/preact/gaze";
import { settle } from "./checks.js";

export async function mount(container) {
  let rename;

  function Host() {
    const [name, setName] = useState("alain@example.com");
    rename = setName;
    const { ref } = useGaze({ travel: 3, lookAt: "pointer" });
    return h(Blobatar, { elementRef: ref, name, animate: "always", size: 200 });
  }

  render(h(Host), container);
  await settle(2);

  const still = document.createElement("div");
  container.after(still);
  const StillHost = () => {
    const { ref } = useGaze({ travel: 3, lookAt: "pointer" });
    return h(Blobatar, { elementRef: ref, name: "alain@example.com", size: 200 });
  };
  render(h(StillHost), still);
  await settle(2);

  return {
    container,
    svg: container.querySelector("svg"),
    img: still.querySelector("img"),
    rename: async (n) => {
      rename(n);
      await settle(2);
    },
    unmount: async () => {
      render(null, container);
      await settle(2);
    },
  };
}
