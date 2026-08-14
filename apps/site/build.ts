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

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
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
