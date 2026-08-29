/**
 * `@blobatar/solid/gaze`, mounted for `checks.js`.
 *
 * `createComponent` rather than JSX, which is also what the compiler emits for
 * `<Blobatar ref={eyes} …/>` — so `ref` arrives as an ordinary prop, falls into
 * the adapter's rest, and is called by Solid's own `spread` on the element.
 * That path is the whole claim this fixture is here to check: the Solid binding
 * needed no change to the adapter, and nothing but a real browser can say so.
 */

import { createSignal } from "solid-js";
import { createComponent, render } from "solid-js/web";
import { Blobatar } from "@blobatar/solid";
import { createGaze } from "@blobatar/solid/gaze";
import { settle } from "./checks.js";

export async function mount(container) {
  const [name, setName] = createSignal("alain@example.com");

  const eyes = createGaze({ travel: 3 });
  /* Aimed before mount, which a signal-free consumer would do the same way. */
  eyes.lookAt("pointer");

  const dispose = render(
    () =>
      createComponent(Blobatar, {
        ref: eyes,
        get name() {
          return name();
        },
        animate: "always",
        size: 200,
      }),
    container,
  );
  await settle(2);

  const still = document.createElement("div");
  container.after(still);
  const stillEyes = createGaze({ travel: 3, target: "pointer" });
  render(
    () =>
      createComponent(Blobatar, {
        ref: stillEyes,
        name: "alain@example.com",
        size: 200,
      }),
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
