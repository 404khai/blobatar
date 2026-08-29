/**
 * `@blobatar/solid/gaze`, mounted for `checks.js`.
 *
 * Solid JSX, compiled by `babel-preset-solid` — the same transform
 * `@blobatar/solid`'s own build runs and the one a consumer's
 * `vite-plugin-solid` runs.
 *
 * `<Blobatar ref={eyes} />` is the line under test, and the whole reason this
 * file is JSX rather than the `createComponent` call it compiles to. That call
 * is the correct compilation target, so writing it by hand checked the chain it
 * starts — `ref` as an ordinary prop, left in the adapter's rest, handed to the
 * element by Solid's own `spread` — while leaving the syntax a consumer types
 * unchecked. Compiling here also opens the component boundary the hydration
 * keys are numbered against, which a hand-written call gets wrong in a way
 * nothing but a hydration check can see.
 *
 * `.solid.jsx` rather than `.jsx`, because the probe's build tells three JSX
 * dialects apart by filename: React's, Preact's and this.
 */

import { createSignal } from "solid-js";
import { Blobatar } from "@blobatar/solid";
import { render } from "solid-js/web";
import { createGaze } from "@blobatar/solid/gaze";
import { settle } from "./checks.js";

export async function mount(container) {
  const [name, setName] = createSignal("alain@example.com");

  const eyes = createGaze({ travel: 3 });
  /* Aimed before mount, which is what a consumer with no signal to watch does. */
  eyes.lookAt("pointer");

  const dispose = render(
    () => <Blobatar ref={eyes} name={name()} animate="always" size={200} />,
    container,
  );
  await settle(2);

  /* The static half: no `animate`, so this is an `<img>` and the ref must be
     inert on it. */
  const still = document.createElement("div");
  container.after(still);
  const stillEyes = createGaze({ travel: 3, target: "pointer" });
  render(
    () => <Blobatar ref={stillEyes} name="alain@example.com" size={200} />,
    still,
  );
  await settle(2);

  return {
    container,
    svg: container.querySelector("svg"),
    img: still.querySelector("img"),
    rename: async (n) => {
      setName(n);
      await settle(2);
    },
    unmount: async () => {
      dispose();
      await settle(2);
    },
  };
}
