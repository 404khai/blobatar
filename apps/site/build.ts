/**
 * Static build.
 *
 * Goes through `Bun.build` rather than the CLI because the Tailwind plugin has
 * to be passed as a plugin *object*. The CLI's `--plugin` flag does not apply
 * it to the CSS pipeline, which fails silently: `@theme` and `@apply` survive
 * into the output as unrecognized at-rules and the bundle ships uncompiled
 * Tailwind source. The size gate below is what makes that failure loud.
 */
import { cp, rm } from "node:fs/promises";
import tailwind from "bun-plugin-tailwind";
// `createElement` rather than JSX, so this file stays a plain `.ts` — it is the
// build, not part of the app, and renaming it to `.tsx` for one call site would
// be the tail wagging the dog.
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { writeFavicon } from "./favicon";
import { writeLlmsTxt } from "./llms";
import { App } from "./src/App";

const OUT = "dist";

/**
 * Two independent checks, because they catch different failures.
 *
 * Surviving at-rules mean Tailwind did not run at all — the definitive compile
 * signal. The size ceiling catches something subtler: Tailwind running but
 * scanning too much, or fonts being inlined as data URIs instead of emitted as
 * files. Both compile cleanly and look fine until you check the number: the
 * real stylesheet here is ~25 KB, and either mistake takes it past 200 KB.
 */
const CSS_CEILING = 40_000;
const UNCOMPILED = ["@theme", "@apply", "@tailwind"];

await rm(OUT, { recursive: true, force: true });

// Both before the bundle. The favicon has to exist for `index.html` to link it,
// so the bundler can hash it into `dist` and rewrite the href; `llms.txt` lands
// in `public/`, which is copied wholesale further down.
await writeFavicon();
await writeLlmsTxt();

const result = await Bun.build({
  entrypoints: ["./index.html"],
  outdir: OUT,
  minify: true,
  plugins: [tailwind],
  // React ships its development build unless NODE_ENV is pinned — worth ~300 KB
  // here, and dev-only warnings have no audience on a static landing page.
  define: { "process.env.NODE_ENV": '"production"' },
});

// Copied rather than bundled: `styles.css` references these at an absolute
// `/fonts/...` URL specifically so the CSS bundler leaves them alone. See the
// comment on the @font-face rules for why.
await cp("fonts", `${OUT}/fonts`, { recursive: true });

// The OG image, at the stable path the meta tags name. Copied rather than
// bundled for exactly that reason: a hashed `og-a1b2c3.png` would be correct
// for a `<link>` the bundler rewrites and useless in a `<meta content>` it
// does not.
await cp("public", OUT, { recursive: true });

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

/**
 * Where this build will be served from.
 *
 * `og:image` and `og:url` have to be absolute — every crawler that matters
 * refuses to resolve a relative one against the page it found it on — and the
 * origin is not knowable from the source, so it arrives as environment.
 * `VERCEL_PROJECT_PRODUCTION_URL` is set on Vercel builds and always names the
 * production domain, including on previews: a preview's own URL changes per
 * deploy, which would leave every shared preview link pointing at an image that
 * outlives it by minutes. `SITE_URL` overrides for anywhere else.
 *
 * Absent both — a local `bun run build` — the tags stay relative. They are
 * wrong, but only for a build nothing is crawling.
 */
const ORIGIN =
  process.env.SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : null);

if (ORIGIN) {
  const page = `${OUT}/index.html`;
  const html = await Bun.file(page).text();
  // Narrow on purpose: `content="/…"` is the shape only the OG tags have. The
  // bundler has already rewritten every real asset reference to a hashed
  // filename by this point, so nothing else in the file starts a `content`
  // attribute with a slash.
  await Bun.write(page, html.replaceAll('content="/', `content="${ORIGIN}/`));
  console.log(`  origin                   ${ORIGIN}`);
}

let failed = false;

for (const output of result.outputs) {
  const bytes = output.size;
  const name = output.path.split("/").pop()!;

  if (name.endsWith(".css")) {
    const css = await Bun.file(output.path).text();
    const survived = UNCOMPILED.filter(rule => css.includes(rule));
    const ok = bytes <= CSS_CEILING && survived.length === 0;
    failed ||= !ok;

    console.log(
      `${ok ? "✓" : "✗"} ${name.padEnd(24)} ${(bytes / 1024).toFixed(1).padStart(7)} KB`,
    );
    if (survived.length) {
      console.error(`  ${survived.join(", ")} survived — Tailwind did not run`);
    } else if (bytes > CSS_CEILING) {
      console.error(`  over ${CSS_CEILING / 1000} KB — content scan is too broad`);
    }
  } else {
    console.log(`  ${name.padEnd(24)} ${(bytes / 1024).toFixed(1).padStart(7)} KB`);
  }
}

if (failed) process.exit(1);

/**
 * Everything below rewrites the built `index.html` for first paint.
 *
 * The measurements behind it, all mobile Lighthouse on this bundle: the page
 * scored 94, and the reason was that nothing rendered until 113 KB of gzipped
 * JavaScript had arrived. Lighthouse's network simulation puts *any* script
 * that starts fetching before the first paint onto the critical path, so the
 * bundle's download time was the first paint, whatever else the page did.
 *
 * Three rewrites, worth roughly +2, +1 and +3 points, and each was measured on
 * its own before being kept:
 *
 *   1. prerender  — put real markup in the document instead of an empty root
 *   2. inline CSS — one round trip instead of two
 *   3. defer JS   — take the bundle off the pre-paint critical path
 *
 * The full-page prerender was tried and is *not* what this does: prerendering
 * the wall as well took the document from 1.6 KB to 28 KB and scored 93, worse
 * than doing nothing. `Wall` renders its field only after mount, so what lands
 * here is the hero, the chat, the closing section and the wall's heading —
 * every word on the page, and none of its sixty SVGs.
 */
const page = `${OUT}/index.html`;
let html = await Bun.file(page).text();

const before = html.length;

/*
 * 0. Preload both faces.
 *
 *    Injected here rather than written into `index.html`, and the reason is the
 *    same quirk the @font-face rules work around: Bun resolves font URLs it
 *    finds in HTML and emits hashed copies, so a `<link rel="preload">` written
 *    in the source file comes out pointing at `geist-variable-a1b2c3.woff2`
 *    while the stylesheet still asks for `/fonts/geist-variable.woff2`. That is
 *    two downloads of the same font — strictly worse than not preloading. The
 *    URLs below are the ones the CSS actually uses.
 *
 *    Worth doing because both faces are above the fold and the code snippet —
 *    set in the mono face — is the LCP element, so the font is on the critical
 *    path by definition. Without a preload the browser only discovers it after
 *    parsing the inline @font-face block.
 *
 *    `crossorigin` is required even though these are same-origin: fonts are
 *    always fetched in CORS mode, and a preload missing it primes a second,
 *    separate cache entry instead of the one the CSS will ask for.
 */
html = html.replace(
  "</head>",
  ["geist-variable", "geist-mono-variable"]
    .map(
      f =>
        `<link rel="preload" href="/fonts/${f}.woff2" as="font" type="font/woff2" crossorigin>`,
    )
    .join("") + "</head>",
);

// 1. Prerender.
html = html.replace(
  '<div id="root"></div>',
  `<div id="root">${renderToString(createElement(App))}</div>`,
);

// 2. Inline the stylesheet, then drop the file it came from — it is
//    render-blocking, and at ~7 KB gzipped it costs a whole round trip to save
//    nothing. Nothing else references it, so leaving it in `dist` would only be
//    a second copy for a crawler to find.
const link = html.match(/<link rel="stylesheet"[^>]*href="\.\/([^"]+\.css)"[^>]*>/);
if (!link) throw new Error("no stylesheet <link> in the built HTML");

const cssPath = `${OUT}/${link[1]}`;
html = html.replace(link[0], `<style>${await Bun.file(cssPath).text()}</style>`);
await rm(cssPath);

/*
 * 3. Load the bundle from an inline script on `load` rather than from a
 *    `<script src>` the preload scanner finds while parsing.
 *
 *    This is the one change here with a real cost, so it is worth being plain
 *    about: it buys first paint by delaying interactivity. The page is fully
 *    *visible* as soon as the HTML lands, but the hero's tuning controls do not
 *    respond until the bundle has loaded and hydrated, a few hundred
 *    milliseconds later on a slow connection.
 *
 *    That trade is defensible here and would not be everywhere: this is a
 *    landing page whose job is to be read, its controls are an optional
 *    flourish rather than the reason anyone arrived, and the alternative —
 *    shipping 113 KB before showing anything — is worse for the same visitor.
 *
 *    The honest way to shrink this cost further is to shrink the bundle: about
 *    51 KB of it is unused on first render, most of it the Radix popover and
 *    toggle-group that only the tuning panel needs. Code-splitting those behind
 *    the trigger would let this script load earlier.
 */
const script = html.match(/<script type="module"[^>]*src="\.\/([^"]+\.js)"[^>]*><\/script>/);
if (!script) throw new Error("no module <script> in the built HTML");

html = html.replace(
  script[0],
  `<script>addEventListener("load",function(){var s=document.createElement("script");` +
    `s.type="module";s.src=${JSON.stringify(`/${script[1]}`)};document.body.appendChild(s)})</script>`,
);

await Bun.write(page, html);

console.log(
  `  index.html (rewritten)   ${(before / 1024).toFixed(1)} KB → ${(html.length / 1024).toFixed(1)} KB`,
);

