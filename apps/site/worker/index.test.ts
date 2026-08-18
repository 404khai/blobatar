import { expect, test } from "bun:test";
import { blobatar } from "blobatar/blob";
import worker from "./index";

// The Worker entry: everything outside /avatar/ is the site. The endpoint's own
// behaviour is tested in `apps/api`; what is asserted here is only the split.

const ORIGIN = "https://blobatar.dev";
const ASSETS = { fetch: async (r: Request) => new Response(`asset:${new URL(r.url).pathname}`) };
const fetchIt = (path: string) => worker.fetch(new Request(ORIGIN + path), { ASSETS });

test("the site is served by the asset pipeline, not the Worker", async () => {
  for (const path of ["/", "/editor", "/og.png", "/robots.txt", "/llms.txt", "/fonts/geist-variable.woff2"]) {
    expect(await (await fetchIt(path)).text()).toBe(`asset:${path}`);
  }
});

test("only /avatar/ reaches the renderer", async () => {
  expect(await (await fetchIt("/avatar/alain")).text()).toBe(blobatar("alain"));
  // A page whose path merely starts with the word is still the site.
  expect(await (await fetchIt("/avatars")).text()).toBe("asset:/avatars");
  expect(await (await fetchIt("/avatar.svg")).text()).toBe("asset:/avatar.svg");
});
