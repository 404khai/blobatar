import { serve, type HTMLBundle } from "bun";
import { readdir } from "node:fs/promises";
import { documentPath, writePages } from "./document";
import { writeFavicon } from "./favicon";
import { writeLlmsTxt } from "./llms";
import { PAGES } from "./manifest";

// All three before anything reads for them: importing a document is what
// resolves its `<link rel="icon">` href, the documents themselves do not exist
// until `writePages` runs, and the asset routes below enumerate `public/`. On a
// clean checkout none of the three generated inputs is there yet.
await writeFavicon();
await writePages();
await writeLlmsTxt();

/**
 * One document per manifest entry.
 *
 * Imported by path rather than by a literal specifier, which is what lets this
 * loop exist at all — Bun resolves an HTML import into a bundle it serves and
 * hot-reloads, and it does that for a computed path the same as a written one.
 */
const documents = new Map<string, HTMLBundle>(
  await Promise.all(
    PAGES.map(
      async page =>
        [page.name, (await import(documentPath(page.name))).default] as const,
    ),
  ),
);

/**
 * Manifest routes, in the order `Bun.serve` has to see them.
 *
 * The page that claims `"/"` becomes the catch-all and must come last, since a
 * `"/*"` ahead of anything would swallow it. Every other page is served at both
 * spellings of its URL, because that is what the deployment does:
 * `html_handling: "auto-trailing-slash"` in `wrangler.jsonc` maps `/editor`
 * onto `editor.html`, and a dev server that answered only one of them would
 * disagree with production about a link somebody had already shared.
 */
const routes = Object.fromEntries(
  PAGES.flatMap(page => {
    const document = documents.get(page.name)!;
    return page.route === "/"
      ? [["/*", document] as const]
      : [
          [page.route, document] as const,
          [`${page.route}.html`, document] as const,
        ];
  }).sort(([a], [b]) => (a === "/*" ? 1 : b === "/*" ? -1 : 0)),
);

/**
 * `public/` at the root, mirroring what the build copies into `dist`.
 *
 * Enumerated at boot rather than matched with a wildcard: `/:file` would sit in
 * front of the SPA fallback and have to decide, per request, whether a miss is
 * a missing asset or a route the page should render. One entry per real file
 * has no such ambiguity — anything not in the directory never matches.
 *
 * Recursive, and that is not a refinement. A flat `readdir` yields `r` and
 * `eggs` as *directory* names, so `/r/avatar.json` matched nothing here and fell
 * through to the SPA catch-all, which answers every unmatched path with the
 * index document — a request for JSON or an image got HTML and a 200, which is
 * worse than a 404 because nothing reports it. Production never showed it:
 * Cloudflare serves `dist/` as a static tree and does not care how deep a file
 * sits. Directory entries are dropped rather than served, since `Bun.file` on a
 * directory is not a response.
 */
const assets = Object.fromEntries(
  (await readdir("public", { recursive: true, withFileTypes: true }))
    .filter(entry => entry.isFile())
    // `parentPath` is the directory the entry was found in, `public` included;
    // the route is what is left after that prefix.
    .map(entry => `${entry.parentPath}/${entry.name}`.slice("public/".length))
    .map(path => [`/${path}`, new Response(Bun.file(`./public/${path}`))]),
);

const server = serve({
  routes: {
    // Served straight off disk, matching the absolute `/fonts/...` URL in
    // `styles.css`. Keeping them out of the bundler is what stops Bun inlining
    // them into the stylesheet as base64.
    "/fonts/:file": req => {
      const file = Bun.file(`./fonts/${req.params.file}`);
      return new Response(file, {
        headers: { "cache-control": "public, max-age=31536000, immutable" },
      });
    },
    ...assets,
    /*
     * Every page, last, so that the catch-all among them cannot shadow an
     * asset. Not client-side routes: each page is its own entrypoint with its
     * own bundle, so that nothing one page needs — the editor's slider, its
     * control set, its layout readback — is downloaded by someone who only ever
     * reads another. See the note on `entrypoints` in `build.ts`.
     */
    ...routes,
	},
	port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
  development: process.env.NODE_ENV !== "production" && { hmr: true, console: true },
});

console.log(`blobatar site → ${server.url}`);
