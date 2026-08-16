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
import { writeFavicon } from "./favicon";
import { writeLlmsTxt } from "./llms";

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

process.exit(failed ? 1 : 0);
