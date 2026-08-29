/**
 * Solid, hydrated: the SSR build's markup taken over by the DOM build.
 *
 * The one path in this repository that nothing tested, before or after the
 * `<Show>` rewrite that made the `<svg>` survive a prop change. The equivalence
 * suite renders the SSR build and compares markup, and this probe's other
 * fixtures mount the DOM build from nothing — hydration is the seam between the
 * two, and a seam is exactly where a change to the component's *structure* goes
 * wrong: Solid matches server output to client tree by hydration keys emitted
 * by its compiler, so a branch that reads differently in the two builds shows
 * up here and nowhere else.
 *
 * What a mismatch actually looks like is worth knowing, because none of it
 * throws: Solid quietly discards the server's nodes and builds its own. The
 * page still renders, the markup still matches the other adapters, and the only
 * visible symptom is the flash and the lost element — which is why the checks
 * below are about node identity rather than about what is on the screen.
 *
 * The gaze binding is hydrated with it, since a `ref` under hydration is a
 * different code path in Solid from a `ref` on a created element, and the
 * binding is worth nothing on a server-rendered page if it does not fire.
 */

import { createSignal } from "solid-js";
import { hydrate } from "solid-js/web";
import { Blobatar } from "@blobatar/solid";
import { createGaze } from "@blobatar/solid/gaze";
import { settle } from "./checks.js";

export async function run(check) {
  const at = (n, s) => `@blobatar/solid (hydrated) ${n} ${s}`;
  const container = document.getElementById("hydrate");

  /* The server's nodes, held by identity. Everything below is a question about
     whether these same objects are still the page after hydration. */
  const served = container.querySelector("svg");
  const servedEyes = container.querySelector(".mo-eyes");
  const servedMarkup = served?.innerHTML;

  check(
    at("A", "the server rendered a blobatar"),
    !!served && !!servedEyes,
    served ? "an <svg> with eyes" : "nothing to hydrate",
  );
  if (!served) return;

  const [name, setName] = createSignal("alain@example.com");
  const eyes = createGaze({ travel: 3 });
  eyes.lookAt("pointer");

  hydrate(
    () => <Blobatar ref={eyes} name={name()} animate="always" size={200} />,
    container,
  );
  await settle(3);

  /* B — the server's element is still the page. This is the whole test: a
     hydration mismatch is silent, and the way to see it is that the node the
     server sent has been replaced by one the client built. */
  const now = container.querySelector("svg");
  check(
    at("B", "hydration adopts the server's element"),
    now === served,
    now === served ? "the same <svg>" : "the client rebuilt it",
  );

  /* C — and adopted it once. A mismatch that appends rather than replaces
     leaves two blobatars, which reads as one on a page where they are
     identical. */
  const n = container.querySelectorAll("svg").length;
  check(at("C", "exactly one blobatar"), n === 1, `${n} <svg> in the container`);

  /* D — the gaze attached during hydration. A `ref` on a hydrated element is a
     different path in Solid from a `ref` on a created one, and the binding is
     worth nothing on a server-rendered page if it does not fire. */
  const travel = container.querySelector("svg")?.style.getPropertyValue("--mo-track-travel");
  check(
    at("D", "the binding runs on a hydrated tree"),
    travel === "3px",
    `--mo-track-travel: ${travel || "(nothing)"}`,
  );

  /* E — and it is a driver, not just a property. */
  const eye = () => getComputedStyle(container.querySelector(".mo-eyes")).getPropertyValue("--mo-track-x");
  const before = eye();
  dispatchEvent(new PointerEvent("pointermove", { clientX: 20, clientY: 20, bubbles: true }));
  await settle();
  const after = eye();
  check(at("E", "the eyes track after hydration"), after !== before, `${before.trim()} → ${after.trim()}`);

  /* F — reactivity survived the takeover. Hydration that adopts the DOM and
     then never updates it is the other silent failure, and the one a `<Show>`
     is most able to cause: a branch built once from server markup and left
     there. */
  setName("tove@example.com");
  await settle(3);
  const redrawn = container.querySelector("svg");
  check(
    at("F", "the picture follows the name"),
    redrawn === served && redrawn.innerHTML !== servedMarkup,
    redrawn !== served
      ? "the <svg> was replaced"
      : redrawn.innerHTML === servedMarkup
        ? "unchanged"
        : "redrawn in place",
  );
}
