/** @jsxImportSource preact */

/**
 * `@blobatar/preact/gaze`, mounted for `checks.js`.
 *
 * The pragma above is the fixture's own claim: this file is compiled against
 * Preact's runtime rather than React's, the way the adapter's `tsconfig.json`
 * sets `jsxImportSource` for the package itself. Without it Bun would compile a
 * Preact component through React's transform and the page would fail in a way
 * that says nothing about the binding.
 *
 * `elementRef` rather than `ref` is the line that differs from `react.jsx`, and
 * it is the one that has to be compiled rather than assumed: Preact takes `ref`
 * out of a function component's props before the component sees them, so a
 * fixture that quietly used `ref` here would pass every check while telling a
 * consumer to write something that cannot work.
 */

import { useState } from "preact/hooks";
import { render } from "preact";
import { Blobatar } from "@blobatar/preact";
import { useGaze } from "@blobatar/preact/gaze";
import { settle } from "./checks.js";

export async function mount(container) {
  let rename;

  function Host() {
    const [name, setName] = useState("alain@example.com");
    rename = setName;
    const { ref } = useGaze({ travel: 3, lookAt: "pointer" });
    return <Blobatar elementRef={ref} name={name} animate="always" size={200} />;
  }

  function StillHost() {
    const { ref } = useGaze({ travel: 3, lookAt: "pointer" });
    return <Blobatar elementRef={ref} name="alain@example.com" size={200} />;
  }

  render(<Host />, container);
  await settle(2);

  const still = document.createElement("div");
  container.after(still);
  render(<StillHost />, still);
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
