/**
 * The page half of `scripts/probe-gaze.ts`. Runs in headless Chrome, mounts
 * every adapter's gaze binding in turn, and posts its verdicts back.
 *
 * Every import goes through a package name, so the `exports` maps and the
 * conditions are under test alongside the behaviour — and every fixture is
 * written in its framework's own source syntax and compiled by that framework's
 * own compiler, so what is checked is the line a consumer copies out of a README
 * rather than the call it happens to compile to.
 *
 * Sequential rather than parallel, and it is not only tidiness: check C moves
 * the pointer and every driver on the page answers, so four bindings settling
 * at once would each be reading a page the others were also changing.
 */

import { verify } from "./checks.js";
import * as react from "./react.jsx";
import * as preact from "./preact.jsx";
import * as vue from "./vue.js";
import * as solid from "./solid.solid.jsx";
import * as svelte from "./svelte.svelte.js";
import * as hydrated from "./solid-hydrate.solid.jsx";

const results = [];
const check = (name, ok, detail) => results.push({ name, ok, detail: String(detail) });

const post = (r) => fetch("/", { method: "POST", body: JSON.stringify(r) });
const fail = (detail) => post([{ name: "the page", ok: false, detail: String(detail) }]);
addEventListener("error", (e) => fail(`${e.message} @ ${e.filename}:${e.lineno}`));
addEventListener("unhandledrejection", (e) => fail(e.reason?.stack ?? e.reason));

const ADAPTERS = [
  ["@blobatar/react", react],
  ["@blobatar/preact", preact],
  ["@blobatar/vue", vue],
  ["@blobatar/solid", solid],
  ["@blobatar/svelte", svelte],
];

for (const [label, adapter] of ADAPTERS) {
  const container = document.createElement("div");
  document.body.append(container);
  await verify(check, label, await adapter.mount(container));
}

/* Last, and in its own container: it takes over markup the server sent rather
   than mounting into an empty div, so it cannot share the loop above. */
await hydrated.run(check);

await post(results);
