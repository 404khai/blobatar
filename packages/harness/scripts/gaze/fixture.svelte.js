/**
 * The page half of `scripts/probe-svelte-gaze.ts`. Runs in headless Chrome and
 * posts its verdicts back.
 *
 * Imports both entries **by name**, so the `exports` map and the `svelte`
 * condition are under test alongside the behaviour — which is the whole reason
 * this fixture is not written against relative paths that would resolve
 * whatever happened to be on disk.
 *
 * `.svelte.js` rather than `.js` because the props below are a `$state` proxy:
 * check D turns on a prop actually changing, and a plain object handed to
 * `mount` never does.
 */

import { mount, unmount } from "svelte";
import { createAttachmentKey } from "svelte/attachments";
import { Blobatar } from "@blobatar/svelte";
import { gaze } from "@blobatar/svelte/gaze";

/** @type {{ name: string, ok: boolean, detail: string }[]} */
const results = [];
const check = (name, ok, detail) => results.push({ name, ok, detail: String(detail) });

const post = (r) => fetch("/", { method: "POST", body: JSON.stringify(r) });
const fail = (detail) => post([{ name: "the page", ok: false, detail: String(detail) }]);
addEventListener("error", (e) => fail(`${e.message} @ ${e.filename}:${e.lineno}`));
addEventListener("unhandledrejection", (e) => fail(e.reason?.stack ?? e.reason));

const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
const settle = async (n = 40) => {
  for (let i = 0; i < n; i++) await frame();
};

/* Aimed before there is anything to aim: the queued request is what makes the
   consumer-side `$effect` in `gaze.js`'s header work at all, since it runs
   before the element exists and Svelte will not run it again on its own. */
const eyes = gaze({ travel: 3 });
eyes.lookAt("pointer");

const props = $state({
  name: "alain@example.com",
  animate: "always",
  size: 200,
  [createAttachmentKey()]: eyes,
});
const app = mount(Blobatar, { target: document.getElementById("app"), props });

await settle(2);

const svg = document.querySelector("#app svg");
const group = svg?.querySelector(".mo-eyes");

/* A — the attachment crosses the component boundary at all. Everything below
   is downstream of this: `{@attach}` on a component is a symbol-keyed prop, and
   it reaches the element only because `Blobatar.svelte` spreads its rest props.
   Nothing in this package can see that seam except by using it. */
check(
  "A the attachment reaches the element",
  !!group && group.style.getPropertyValue("--mo-track-travel") === "3px",
  group
    ? `--mo-track-travel: ${JSON.stringify(group.style.getPropertyValue("--mo-track-travel"))}`
    : "no .mo-eyes rendered",
);

/* B — and lands where both readers look. `gaze.css` reads the excursion on
   `.mo-eyes` and the driver reads it back off the same element to derive its
   write threshold, so a value the computed style does not carry is one the
   picture does not either. */
check(
  "B the excursion reaches the stylesheet",
  !!group && getComputedStyle(group).getPropertyValue("--mo-track-travel").trim() === "3px",
  group ? `computed: ${getComputedStyle(group).getPropertyValue("--mo-track-travel").trim()}` : "—",
);

/* C — the driver is running and aimed. */
const read = () =>
  ["--mo-track-x", "--mo-track-y"].map((p) =>
    getComputedStyle(group).getPropertyValue(p).trim(),
  );
const before = read();
dispatchEvent(new PointerEvent("pointermove", { clientX: 20, clientY: 20, bubbles: true }));
await settle();
const after = read();
check(
  "C the eyes track the pointer",
  after[0] !== before[0] || after[1] !== before[1],
  `${before.join(",")} → ${after.join(",")}`,
);

/* D — the regression that moved the excursion off the `<svg>`.
   `Blobatar.svelte` writes its custom properties as one `style` attribute, so
   any prop change replaces the whole declaration; an inline property written on
   that element goes with it, and the symptom is a blobatar that renders
   perfectly and stops moving halfway through a session. */
props.name = "tove@example.com";
await settle(5);
check(
  "D the excursion survives a prop change",
  group.style.getPropertyValue("--mo-track-travel") === "3px",
  `after re-render: ${JSON.stringify(group.style.getPropertyValue("--mo-track-travel"))}`,
);

/* E — teardown puts the element back. The driver's own properties go with
   `stop()`; the excursion is this binding's to remove, and removing rather than
   restoring is correct because nothing was overwritten. */
unmount(app);
await settle(2);
check(
  "E teardown leaves nothing behind",
  !document.querySelector("#app svg"),
  document.querySelector("#app svg") ? "the blobatar is still mounted" : "unmounted",
);

/* F — a static blobatar is an `<img>`, which has no eyes to move. The
   attachment must be inert there rather than running a frame loop for a picture
   that cannot change. */
const still = gaze({ travel: 3, target: "pointer" });
mount(Blobatar, {
  target: document.getElementById("still"),
  props: { name: "alain@example.com", size: 200, [createAttachmentKey()]: still },
});
await settle(2);
const img = document.querySelector("#still img");
check(
  "F inert on a static blobatar",
  !!img && !img.style.getPropertyValue("--mo-track-travel"),
  img ? "the <img> is untouched" : "no <img> rendered",
);

await post(results);
