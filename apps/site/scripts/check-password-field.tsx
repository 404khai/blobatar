/**
 * Behaviour gate for `registry/password-field.tsx`, and for the one thing in
 * this app that consumes `useGaze` declaratively.
 *
 * Every other test in this app reads strings: the registry manifest, the
 * showcase list, the generated `llms.txt`. None of them can see this component,
 * because there is nothing about it in the markup. What it does is decide where
 * a pair of eyes points, frame by frame, out of a pointer position and a caret
 * offset, and the only honest oracle for that is a browser with both.
 *
 * So this is the same shape as `packages/blobatar/scripts/probe-compose.ts` and
 * `apps/video/scripts/check-watch.ts`: bundle the real source, drive it in
 * headless Chrome, assert on what moved. It is deliberately not a `bun test`
 * file — it needs a browser on the machine, and a test that silently skips when
 * one is missing is worse than no test, because the suite still reports green.
 *
 * **Chrome is launched claiming a fine pointer**, which headless is not. The
 * gaze driver declines to attach under `(hover: hover) and (pointer: fine)`,
 * correctly and exactly as it does on a phone, so without those Blink settings
 * this file would measure a component that never starts. Same flags, same
 * reason, as the library's own probe.
 *
 * Five claims, and they are the sentences the component's header makes:
 *
 *  1. The eyes follow the pointer.
 *  2. While you are typing, the caret wins. The pointer can be anywhere.
 *  3. It is focus that holds them there, not the keystroke: a long pause in the
 *     middle of a password does not hand the eyes back.
 *  4. Leaving the field does.
 *  5. Revealing the password sends the eyes home and changes the pose.
 *
 * And one that is not about this component at all: the hook's `lookAt` *option*
 * aims a blobatar on mount and re-aims it when it changes. That belongs here
 * because this is the only browser in this repo's gates that runs React, and
 * because `Hero.tsx` is the consumer — the front page's blobatar follows the
 * cursor through that option and nothing else would notice it stopping, since
 * a face that holds still renders perfectly.
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";

const DIR = "scripts/.pw";
const PORT = 8930;

/* ------------------------------------------------------------------ bundle */

const entry = `${DIR}/entry.tsx`;
mkdirSync(DIR, { recursive: true });
writeFileSync(
  entry,
  `import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Blobatar } from "@blobatar/react";
import { useGaze } from "@blobatar/react/gaze";
import { PasswordField } from "../../registry/password-field";
import "blobatar/motion.css";
import "blobatar/gaze.css";

type R = { name: string; ok: boolean; detail: string };
const results: R[] = [];
const report = (name: string, ok: boolean, detail: string) =>
  results.push({ name, ok, detail });

const frame = () => new Promise(requestAnimationFrame);
const settle = async (n = 40) => { for (let i = 0; i < n; i++) await frame(); };

const host = document.createElement("div");
document.body.appendChild(host);
createRoot(host).render(<PasswordField name="alain00" size={160} />);

(async () => {
  try {
    await settle(4);
    const svg = host.querySelector("svg")!;
    const eyes = host.querySelector(".mo-eyes") as SVGElement;
    const root = host.querySelector(".mo-root") as SVGElement;
    const input = host.querySelector("input") as HTMLInputElement;
    const show = host.querySelector("button") as HTMLButtonElement;

    /** The excursion the driver has written, as a number. */
    const aimX = () => parseFloat(eyes.style.getPropertyValue("--mo-track-x") || "0");
    const aimY = () => parseFloat(eyes.style.getPropertyValue("--mo-track-y") || "0");

    const point = async (x: number, y: number) => {
      dispatchEvent(new PointerEvent("pointermove", { clientX: x, clientY: y }));
      await settle();
    };

    const r = svg.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;

    // 1 — the pointer.
    await point(cx + 3000, cy);
    const right = aimX();
    await point(cx - 3000, cy);
    const left = aimX();
    report(
      "the eyes follow the pointer",
      right > 0.9 && left < -0.9,
      \`right \${right.toFixed(3)}, left \${left.toFixed(3)} of a ±1 excursion\`,
    );

    // 2 — the caret wins while typing.
    //
    // Typed through the native setter, because React tracks the input's value
    // on the node and ignores an assignment it did not see: dispatching an
    // \`input\` event after a plain \`input.value = …\` fires the handler with the
    // *old* value, which is the classic way a test like this passes while
    // driving nothing.
    const set = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!;
    input.focus();
    set.call(input, "hunter2hunter2hunter2");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();

    // The pointer is parked far to the right; the caret is at the end of a
    // string in a field *below* the face. If the caret is winning, the eyes are
    // pointing down. If the pointer is winning, they are pointing hard right.
    await point(cx + 3000, cy);
    const typingX = aimX();
    const typingY = aimY();
    const caret = input.getBoundingClientRect();
    report(
      "the caret wins over the pointer while typing",
      typingY > 0.5 && typingX < right,
      \`aim (\${typingX.toFixed(3)}, \${typingY.toFixed(3)}) with the pointer at \` +
        \`x+3000 and the field \${(caret.top - cy).toFixed(0)}px below the face\`,
    );

    // 3 — focus, not the keystroke, is what holds the eyes there.
    //
    // Two seconds of frames with no input at all, well past any pause a person
    // takes mid-password. The pointer has not moved off x+3000, so if anything
    // is standing the caret branch down on a timer the eyes are hard right by
    // now.
    await settle(140);
    const heldX = aimX();
    const heldY = aimY();
    report(
      "the caret still wins long after the last keystroke",
      heldY > 0.5 && heldX < right,
      \`aim (\${heldX.toFixed(3)}, \${heldY.toFixed(3)}) two seconds after the \` +
        \`last keystroke, pointer still at x+3000\`,
    );

    // 4 — leaving the field hands the eyes back.
    input.blur();
    await settle();
    const blurredX = aimX();
    report(
      "blurring the field hands the eyes back to the pointer",
      blurredX > 0.9,
      \`aim x \${blurredX.toFixed(3)} of a ±1 excursion, pointer at x+3000\`,
    );

    // 5 — revealing looks away.
    const posedBefore = root.classList.contains("mo-expr");
    show.click();
    await settle(60);
    const homeX = aimX();
    const homeY = aimY();
    const posedAfter = root.classList.contains("mo-expr");
    report(
      "revealing the password sends the eyes home and changes the pose",
      Math.abs(homeX) < 0.05 &&
        Math.abs(homeY) < 0.05 &&
        !posedBefore &&
        posedAfter &&
        input.type === "text",
      \`aim (\${homeX.toFixed(3)}, \${homeY.toFixed(3)}), pose \${posedBefore} → \` +
        \`\${posedAfter}, input now \${input.type}\`,
    );
  } catch (err) {
    report("harness threw", false, String((err as Error)?.stack ?? err));
  }

  /*
   * 6 — the hook's declarative target, which is a second component because it
   * is a second consumer shape.
   *
   * Everything above drives \`lookAt\` as a function, which is what a component
   * with a target that changes does. The option is what a component with one
   * that does not does — \`Hero.tsx\` on the front page is exactly this, and
   * nothing else in this repo would notice if it stopped working, because a
   * blobatar that quietly holds still renders perfectly.
   *
   * Two halves, and the second is the one worth the setup: the option has to be
   * *re-applied* when it changes rather than read once on mount, because an
   * option read once that looks declarative is the React trap the hook's own
   * docstring is about.
   */
  try {
    const spot = document.createElement("div");
    document.body.appendChild(spot);

    let set: (t: "pointer" | "rest") => void = () => {};
    function Declared() {
      const [target, setTarget] = useState<"pointer" | "rest">("pointer");
      set = setTarget;
      const { ref } = useGaze({ travel: 16, lookAt: target });
      return <Blobatar ref={ref} name="alain00" size={160} animate="always" />;
    }
    createRoot(spot).render(<Declared />);
    await settle(8);

    const eyes = spot.querySelector(".mo-eyes") as SVGElement;
    const aim = () => parseFloat(eyes.style.getPropertyValue("--mo-track-x") || "0");
    const svg = spot.querySelector("svg")!;
    const box = svg.getBoundingClientRect();

    /* Mounted and never aimed by hand: if the option did not reach the driver,
       this is a face that renders and holds still. */
    dispatchEvent(
      new PointerEvent("pointermove", {
        clientX: box.left + box.width / 2 + 3000,
        clientY: box.top + box.height / 2,
      }),
    );
    await settle();
    const declared = aim();

    /* Changed, not re-mounted. The pointer stays where it is, so an option that
       is only read once leaves the eyes hard right. */
    set("rest");
    await settle(60);
    const rested = aim();

    report(
      "the hook's lookAt option aims on mount and re-aims when it changes",
      declared > 0.9 && Math.abs(rested) < 0.05,
      \`option "pointer" aims \${declared.toFixed(3)} of a ±1 excursion with no \` +
        \`lookAt() call; switching it to "rest" returns to \${rested.toFixed(3)} \` +
        \`with the pointer still parked at x+3000\`,
    );
  } catch (err) {
    report("harness threw on the hook", false, String((err as Error)?.stack ?? err));
  }

  await fetch("/result", { method: "POST", body: JSON.stringify(results) });
})();
`,
);

const build = await Bun.build({
  entrypoints: [entry],
  target: "browser",
  define: { "process.env.NODE_ENV": '"development"' },
});
if (!build.success) {
  for (const log of build.logs) console.error(log);
  process.exit(1);
}

/* Bun emits the stylesheet imports as a sibling artifact; both are served from
   memory below rather than written out, so nothing here touches `public/`. */
const assets = new Map<string, { body: string; type: string }>();
for (const out of build.outputs) {
  assets.set(
    `/${out.path.replace(/^\.\//, "")}`,
    {
      body: await out.text(),
      type: out.path.endsWith(".css") ? "text/css" : "text/javascript",
    },
  );
}
const js = [...assets.keys()].find((k) => k.endsWith(".js"))!;
const cssHref = [...assets.keys()].find((k) => k.endsWith(".css"));

/* ------------------------------------------------------------------- serve */

let deliver: (r: { name: string; ok: boolean; detail: string }[]) => void;
const done = new Promise<{ name: string; ok: boolean; detail: string }[]>(
  (res) => (deliver = res),
);

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const { pathname } = new URL(req.url);
    if (pathname === "/result") {
      deliver(await req.json());
      return new Response("ok");
    }
    const asset = assets.get(pathname);
    if (asset) {
      return new Response(asset.body, { headers: { "content-type": asset.type } });
    }
    return new Response(
      `<!doctype html><meta charset="utf-8">` +
        (cssHref ? `<link rel="stylesheet" href="${cssHref}">` : "") +
        `<style>body{margin:0;padding:40px}</style>` +
        `<body><script type="module" src="${js}"></script>`,
      { headers: { "content-type": "text/html" } },
    );
  },
});

/* ------------------------------------------------------------------ browser */

const BINS = [process.env.CHROME, "google-chrome", "google-chrome-stable", "chromium", "chromium-browser"];
const bin = (BINS.filter(Boolean) as string[]).find(
  (b) => Bun.spawnSync([b, "--version"], { stderr: "ignore" }).success,
);

if (!bin) {
  server.stop(true);
  rmSync(DIR, { recursive: true, force: true });
  console.error(
    "✗ gaze: no Chrome on this machine, so the one gate that can see the " +
      "password field and the hook did not run. Install Chrome or set CHROME.",
  );
  process.exit(1);
}

const profile = `${DIR}/profile`;
const proc = Bun.spawn(
  [
    bin,
    "--headless=new",
    // Headless reports no pointer and no hover. The gaze driver declines to
    // attach without both, so these are what make the component testable at
    // all: 4 is `fine` in Blink's pointer enum, 2 is `hover` in its hover enum.
    "--blink-settings=availablePointerTypes=4,primaryPointerType=4," +
      "availableHoverTypes=2,primaryHoverType=2",
    "--disable-gpu",
    "--no-sandbox",
    "--hide-scrollbars",
    `--user-data-dir=${profile}`,
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    `http://localhost:${PORT}/`,
  ],
  { stdout: "ignore", stderr: "ignore" },
);

const results = await Promise.race([
  done,
  new Promise<null>((r) => setTimeout(() => r(null), 30_000)),
]);

proc.kill();
server.stop(true);
rmSync(DIR, { recursive: true, force: true });

if (!results) {
  console.error("✗ gaze: the page never reported back within 30s");
  process.exit(1);
}

let failed = false;
for (const r of results) {
  console.log(`${r.ok ? "✓" : "✗"} gaze: ${r.name} — ${r.detail}`);
  if (!r.ok) failed = true;
}
process.exit(failed ? 1 : 0);
