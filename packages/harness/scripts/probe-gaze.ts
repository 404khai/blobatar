/**
 * Every adapter's gaze binding, checked in a real browser.
 *
 * The bindings are four shapes — a hook, a ref, a composable, an attachment —
 * because four frameworks disagree about how a caller reaches an element, and
 * each shape rests on plumbing this repository does not own: a symbol-keyed
 * prop carried by a spread, a `ref` read out of a rest object by Solid's own
 * `spread`, `$el` off a Vue component instance, a callback ref Preact declines
 * to give a function component. None of it is visible to a test that reads
 * markup, and one of them — Svelte's — does not run under `generate: "server"`
 * at all, which is what the suite renders. So `bun test` would stay green
 * against a binding that never reached an element.
 *
 * Checks D and E are the other reason this exists. The Svelte binding writes the
 * excursion on `.mo-eyes` rather than on the `<svg>` because Svelte rewrites
 * that element's whole `style` attribute whenever a prop changes; the first
 * draft, which wrote it where the React hook does, passed every other check
 * here while losing the excursion the moment a `name` changed. Every adapter is
 * asked the same question rather than only the one that failed it — and asking
 * it of all five is what turned up the Solid adapter rebuilding its whole
 * `<svg>` on any prop change, which left the binding holding a detached node
 * and every idle animation restarting from phase zero.
 *
 * Modelled on `packages/blobatar/scripts/probe-compose.ts`, including the
 * handoff: the page posts its verdicts rather than being read out of the
 * browser, so there is no protocol client in this repository. One engine rather
 * than that file's two — what is under test is each framework's own plumbing
 * and a couple of custom properties, not a rendering divergence.
 */

import { mkdirSync, rmSync } from "node:fs";
import { compile, compileModule } from "svelte/compiler";

const DIR = `${import.meta.dir}/gaze/out`;
const CHROME = [process.env.CHROME, "google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]
  .filter(Boolean)
  .find((bin) => Bun.spawnSync([bin!, "--version"], { stderr: "ignore" }).success);

if (!CHROME) {
  console.warn(
    "! gaze probe SKIPPED — no Chrome found.\n" +
      "  It is the only check that can see whether a binding reaches its element.\n" +
      "  Install Chrome, or set CHROME=/path/to/binary, before trusting a green run.",
  );
  process.exit(0);
}

/**
 * The consumer's compiler, which is the job this package already does once for
 * the test suite (`test/svelte-plugin.ts`). Not shared with it: that one is
 * `generate: "server"` and registered globally for `bun test`, and this one has
 * to emit DOM code and handle `.svelte.js` too, since the Svelte fixture's
 * props are a `$state` proxy. The other four fixtures need no transform at all
 * — they call `createElement`, `h` and `createComponent` by hand, which is what
 * each framework's JSX compiles to anyway.
 */
const svelte: import("bun").BunPlugin = {
  name: "svelte-client",
  setup(build) {
    build.onLoad({ filter: /\.svelte\.js$/ }, async (args) => ({
      contents: compileModule(await Bun.file(args.path).text(), {
        filename: args.path,
        generate: "client",
      }).js.code,
      loader: "js",
    }));
    build.onLoad({ filter: /(?<!\.svelte)\.svelte$/ }, async (args) => ({
      contents: compile(await Bun.file(args.path).text(), {
        filename: args.path,
        generate: "client",
      }).js.code,
      loader: "js",
    }));
  },
};

rmSync(DIR, { recursive: true, force: true });
mkdirSync(DIR, { recursive: true });

const build = await Bun.build({
  entrypoints: [`${import.meta.dir}/gaze/fixture.js`],
  outdir: DIR,
  target: "browser",
  plugins: [svelte],
  // The same condition `bun test` passes, and for the same reason: the Svelte
  // adapter is source-resolved, so without it the package does not resolve at
  // all and that fixture's by-name imports would be measuring nothing. It
  // changes nothing for the other four — Solid's own condition is `solid`, so
  // it resolves the DOM build under `default`, which is what a consumer without
  // `vite-plugin-solid` gets.
  conditions: ["svelte"],
  define: { "process.env.NODE_ENV": '"production"' },
});
if (!build.success) {
  for (const log of build.logs) console.error(log);
  process.exit(1);
}

/* Both stylesheets, from `dist` rather than from source: the excursion is a
   registered custom property with an initial value of `0px`, so a page missing
   `gaze.css` is a page where every check below reads zero. */
const css = await Promise.all(
  ["motion.css", "gaze.css"].map((f) =>
    Bun.file(`${import.meta.dir}/../../blobatar/dist/${f}`).text(),
  ),
);
/**
 * The server's half of the hydration fixture, rendered here rather than there.
 *
 * Importing `@blobatar/solid` from this script resolves the `node` condition,
 * which is the SSR build — a different compilation of the same source, and the
 * one whose markup a consumer's server sends. The page then hydrates it with
 * the DOM build, which is what a browser resolves. Both halves are the real
 * artifacts, resolved the way a consumer resolves them, which is the only way
 * this check means anything.
 *
 * `generateHydrationScript` is not optional and fails quietly without: it
 * defines the global Solid's client build reads its hydration state out of, and
 * a page missing it hydrates by rebuilding everything, which is precisely what
 * check B is here to catch. That would be a false failure rather than a false
 * pass, but it is worth stating which of the two this line is holding.
 */
const { Blobatar: Served } = await import("@blobatar/solid");
const { renderToString, generateHydrationScript, createComponent } = await import("solid-js/web");
/*
 * `createComponent`, not a plain call, and the two are not interchangeable
 * here. It is what `<Blobatar/>` compiles to, and it opens a component
 * boundary that the hydration keys are numbered against — so calling the
 * function directly on this side (which the equivalence suite does, and is
 * right to: it only compares markup) numbers the server's nodes differently
 * from the client's and hydration rebuilds everything. That was the first
 * result this fixture produced, and it was the probe's mistake rather than the
 * adapter's.
 */
const served = renderToString(() =>
  /* `as never` twice, and for the reason the equivalence suite states about its
     own cast: the component is typed against Solid's JSX, which this file
     cannot spell without a JSX transform it does not run. */
  createComponent(Served as never, {
    name: "alain@example.com",
    animate: "always",
    size: 200,
  } as never),
);

await Bun.write(
  `${DIR}/index.html`,
  `<style>${css.join("\n")}\nbody{margin:0}</style>` +
    `${generateHydrationScript()}` +
    `<body><div id="hydrate">${served}</div>` +
    `<script type="module" src="fixture.js"></script>`,
);

type Result = { name: string; ok: boolean; detail: string };

let deliver: (r: Result[] | null) => void = () => {};
const server = Bun.serve({
  port: 0,
  // `127.0.0.1` rather than the wildcard, and served rather than opened from
  // disk: a `type="module"` script on a `file://` page has a null origin and is
  // refused outright, which looks exactly like a page that ran and found
  // nothing.
  hostname: "127.0.0.1",
  async fetch(req) {
    if (req.method === "POST") {
      deliver((await req.json()) as Result[]);
      return new Response("ok");
    }
    const name = new URL(req.url).pathname.slice(1) || "index.html";
    const f = Bun.file(`${DIR}/${name}`);
    return (await f.exists()) ? new Response(f) : new Response(null, { status: 404 });
  },
});

const reported = new Promise<Result[] | null>((resolve) => {
  deliver = resolve;
  setTimeout(() => resolve(null), 60_000).unref();
});

const profile = `${DIR}/profile`;
mkdirSync(profile, { recursive: true });
const proc = Bun.spawn(
  [
    CHROME,
    "--headless=new",
    // Headless reports no pointer and no hover, which is correct for what it is
    // and would make every check here untestable: the driver declines to attach
    // under `(hover: hover) and (pointer: fine)`, exactly as it does on a phone.
    // Blink's own settings for what the device claims to have; 4 is `fine` and 2
    // is `hover` in the two enums.
    "--blink-settings=availablePointerTypes=4,primaryPointerType=4," +
      "availableHoverTypes=2,primaryHoverType=2",
    "--disable-gpu",
    "--no-sandbox",
    "--hide-scrollbars",
    `--user-data-dir=${profile}`,
    // Headless throttles rAF in a hidden page, and the pursuit is a frame loop.
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
    `${server.url}index.html`,
  ],
  { stdout: "ignore", stderr: "ignore" },
);

const results = await reported;
proc.kill();
server.stop(true);

let failed = false;
if (!results) {
  failed = true;
  console.error("✗ gaze probe — the page never reported a result");
} else {
  for (const r of results) {
    failed ||= !r.ok;
    console.log(`${r.ok ? "✓" : "✗"} ${r.name} — ${r.detail}`);
  }
}

rmSync(DIR, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
