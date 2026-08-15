/**
 * Composition gate — the one check that needs a real browser.
 *
 * `bun test` can prove a great deal about this library from strings alone, and
 * it proved nothing at all about the two failures that shipped: eyes that
 * deformed on the wrong axis, and a morph that never ran. Both live in the gap
 * between what the renderer emits and what a CSS engine does with it, and
 * nothing in a string can see across that gap.
 *
 * So this bundles the real source, loads it in headless Chrome, and measures
 * pixels. It is deliberately *not* a `bun test` file: it needs a browser on the
 * machine, and a test file that silently skips when one is missing is worse than
 * no test, because the suite still reports green. Run explicitly, and part of
 * `bun run check`, which warns loudly rather than passing quietly when there is
 * no Chrome to run.
 *
 * See `scripts/probe/entry.tsx` for what is actually asserted, and
 * `docs/motion-probe.html` for the hand-run probe of the idle layers, which this
 * does not replace — that one is about whether the motion *reads* well.
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { avatar, _layout, _parts } from "../src/avatar";
import { happy, idle, mad, sad, type Expression } from "../src/expression";
import { launch } from "./probe/cdp";

const CHROME = [
  process.env.CHROME,
  "google-chrome",
  "google-chrome-stable",
  "chromium",
  "chromium-browser",
].filter(Boolean) as string[];

async function findChrome() {
  for (const bin of CHROME) {
    const p = Bun.spawnSync([bin, "--version"], { stderr: "ignore" });
    if (p.success) return bin;
  }
  return null;
}

const chrome = await findChrome();
if (!chrome) {
  console.warn(
    "! composition gate SKIPPED — no Chrome found.\n" +
      "  This is the only check that can see a CSS-versus-geometry divergence.\n" +
      "  Install Chrome or set CHROME=/path/to/binary before trusting a green run.",
  );
  process.exit(0);
}

const POSES: [string, Expression | undefined][] = [
  ["idle", undefined],
  ["happy", happy],
  ["sad", sad],
  ["mad", mad],
];

/**
 * Seeds chosen by lean, not at random. The bug this gate exists for is
 * invisible at lean 0 and worst at the 12° ceiling, so a uniform sample would
 * mostly measure the cases that cannot fail.
 */
const seeds = Array.from({ length: 600 }, (_, i) => `seed-${i}`)
  .map((s) => ({
    s,
    lean: Math.max(
      ...(_layout(s).eyes as { rot: number }[]).map((e) => Math.abs(e.rot)),
    ),
  }))
  .sort((a, b) => b.lean - a.lean)
  .slice(0, 12);

const strip = (svg: string) =>
  svg.slice(svg.indexOf(">") + 1, svg.lastIndexOf("</svg>"));

/** Only the fields `outline()` needs, and only the eyes. */
const eyes = (l: ReturnType<typeof _layout>) =>
  (l.eyes as { cx: number; cy: number; rx: number; ry: number; rot: number }[])
    .map(({ cx, cy, rx, ry, rot }) => ({ cx, cy, rx, ry, rot }));

const cases = seeds.flatMap(({ s, lean }) =>
  POSES.map(([name, e]) => {
    const p = _parts(s, { animate: "always", expression: e });
    return {
      seed: s,
      name,
      lean,
      static: strip(avatar(s, { expression: e ?? idle })),
      cls: p.cls!,
      inner: p.inner,
      vars: p.vars!,
      // The pose baked in, and the same avatar without it. The page draws the
      // second and asks whether CSS turns it into the first.
      posed: eyes(_layout(s, { expression: e ?? idle })),
      base: eyes(_layout(s)),
      // What the *static* path paints. A tinting pose resolves its colour into
      // the markup here and into `--mo-head`/`--mo-eye` on the animated side,
      // which are two serializations of one decision and have nothing forcing
      // them to agree — the same gap check A exists for, one axis over.
      fill: (() => {
        const l = _layout(s, { expression: e ?? idle });
        return [l.palette.head!, l.palette.eye!];
      })(),
    };
  }),
);

const DIR = "scripts/.probe";
rmSync(DIR, { recursive: true, force: true });
mkdirSync(DIR, { recursive: true });

const build = await Bun.build({
  entrypoints: ["scripts/probe/entry.tsx"],
  target: "browser",
  define: { "process.env.NODE_ENV": '"development"' },
});
if (!build.success) {
  for (const log of build.logs) console.error(log);
  process.exit(1);
}

// Both scripts go to disk and load by `src`. Inlined, React's development
// build closes the `<script>` early on the first `</script>` inside one of its
// own string literals, and the rest of the bundle parses as markup — which
// presents as a page that simply produces no result.
writeFileSync(`${DIR}/cases.js`, `window.CASES=${JSON.stringify(cases)}`);
writeFileSync(`${DIR}/probe.js`, await build.outputs[0]!.text());

const css = readFileSync(new URL("../src/motion.css", import.meta.url), "utf8");
const file = `${DIR}/probe.html`;
writeFileSync(
  file,
  `<!doctype html><meta charset="utf-8"><style>${css}
/* Has to sit on \`.mo-root\` itself: \`--mo-amp\` is declared on that element, and
   an element's own declaration beats an inherited one however important the
   ancestor's is. At amplitude 0 every idle layer folds to the identity, so what
   is left on screen is the pose and nothing else.

   \`--mo-shake\` is pinned for a different reason. It is not ambient — it is part
   of the pose — but it is the one pose channel the static path cannot express,
   because a bake is a still frame and a tremor is a loop. Leaving it running
   makes check A compare a shaking avatar against a stationary one and report the
   phase it happened to sample as a divergence, which is exactly what it did:
   0.37px of "disagreement" that was the feature working. Check D below measures
   it properly, unfrozen. */
.mo-frozen { --mo-amp: 0 !important; --mo-shake: 0 !important; }
.mo-frozen-amp { --mo-amp: 0 !important; }
body { margin: 0 }
</style><body><script src="cases.js"></script><script type="module" src="probe.js"></script>`,
);

// Served rather than opened from disk: a `type="module"` script on a `file://`
// page has a null origin and is refused outright, which looks exactly like a
// page that ran and found nothing.
const server = Bun.serve({
  port: 0,
  async fetch(req) {
    const name = new URL(req.url).pathname.slice(1) || "probe.html";
    const f = Bun.file(`${DIR}/${name}`);
    // Chrome asks for a favicon unprompted; a thrown ENOENT here would be the
    // loudest thing in the output and mean nothing.
    return (await f.exists())
      ? new Response(f)
      : new Response(null, { status: 404 });
  },
});

const session = await launch(chrome, `${server.url}${file.split("/").pop()}`);

let results: { name: string; ok: boolean; detail: string }[] | undefined;
try {
  // Polled rather than awaited on a fixed sleep: the geometry pass walks 48
  // cases a frame at a time, and how long that takes is the machine's business.
  for (let i = 0; i < 600 && !results; i++) {
    results = await session.eval("globalThis.RESULTS ?? null");
    if (!results) await Bun.sleep(100);
  }
} finally {
  await session.close();
  server.stop(true);
}

if (!results) {
  console.error("✗ composition gate — the page never reported a result");
  process.exit(1);
}

let failed = false;
for (const r of results) {
  failed ||= !r.ok;
  console.log(`${r.ok ? "✓" : "✗"} ${r.name} — ${r.detail}`);
}
console.log(
  `  ${cases.length} case${cases.length === 1 ? "" : "s"}: ${seeds.length} of the` +
    ` most-leaned seeds × ${POSES.length} poses, leans ${seeds[seeds.length - 1]!.lean.toFixed(1)}–${seeds[0]!.lean.toFixed(1)}°`,
);

rmSync(DIR, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
