/**
 * The seven things every gaze binding has to do, asked of each adapter in turn.
 *
 * The bindings are four different shapes — a hook, a ref, a composable, an
 * attachment — because four frameworks disagree about how a caller reaches an
 * element. What they must not disagree about is any of this: the same driver on
 * the same element, opted in the same way, torn down the same way. So the
 * mounting is each fixture's own and the assertions are shared, which is the
 * same split `test/cases.ts` makes for the rendering.
 */

export const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
export const settle = async (n = 40) => {
  for (let i = 0; i < n; i++) await frame();
};

const track = (el) =>
  ["--mo-track-x", "--mo-track-y"]
    .map((p) => getComputedStyle(el).getPropertyValue(p).trim())
    .join(",");

/**
 * @param check  collects one verdict
 * @param label  the adapter, as a consumer names it
 * @param m      what the fixture mounted: `{ svg, rename, unmount, img }`
 */
export async function verify(check, label, m) {
  const at = (n, s) => `${label} ${n} ${s}`;
  const group = m.svg?.querySelector(".mo-eyes");

  /* A — the binding reached the element at all. Everything below is downstream
     of it, and it is the half of each binding that this repository does not
     own: a prop under a symbol key, a ref through a spread, `$el` off a
     component instance. */
  check(
    at("A", "the binding reaches the element"),
    !!group,
    group ? "the eyes are there" : "no .mo-eyes rendered",
  );
  if (!group) return;

  /* B — the excursion landed where `gaze.css` reads it and where the driver
     reads it back. A value neither can see is a face that never moves. */
  const computed = getComputedStyle(group).getPropertyValue("--mo-track-travel").trim();
  check(at("B", "the excursion reaches the stylesheet"), computed === "3px", `computed ${computed}`);

  /* C — the driver runs and is aimed. */
  const before = track(group);
  dispatchEvent(new PointerEvent("pointermove", { clientX: 20, clientY: 20, bubbles: true }));
  await settle();
  const after = track(group);
  check(at("C", "the eyes track the pointer"), after !== before, `${before} → ${after}`);

  /* D — a prop change does not take the excursion with it.
     Re-queried rather than re-read, and that is the whole subtlety: the eyes
     arrive inside `parts.inner`, which every adapter writes as one opaque
     string, so a new `name` replaces `.mo-eyes` with a different element in all
     five. Reading the old one back would report the inline value still sitting
     on a node that is no longer in the document — which is exactly how the
     first draft of this check passed while the Svelte binding was broken.
     What a consumer sees is whether the excursion reaches whatever `.mo-eyes`
     is *now*, so that is what this asks. */
  await m.rename("tove@example.com");
  await settle(5);
  /* Queried from the container rather than from the `<svg>` this started with,
     because two of the adapters replace that element too: Solid re-evaluates
     the whole branch when its memo changes, and a detached node's computed
     style is empty for every property, which reads as a failure that is really
     the probe holding the wrong node. */
  const fresh = m.container.querySelector(".mo-eyes");
  const kept = fresh && getComputedStyle(fresh).getPropertyValue("--mo-track-travel").trim();
  check(
    at("D", "the excursion survives a prop change"),
    kept === "3px",
    fresh ? `computed ${kept || "(nothing)"}` : "no .mo-eyes after the change",
  );

  /* E — and the `<svg>` itself is still the one the binding was given.
     Every binding holds the element it started on, so an adapter that rebuilds
     it on a prop change leaves a driver measuring a detached node — and takes
     every idle animation under it back to phase zero, which is the failure the
     adapters' own comments are about one level down. The Solid adapter did
     exactly this until `<Show>` replaced a ternary: a dynamic branch is one
     computation, so it re-ran on any prop at all. Checked by identity, which is
     the only way to see it: the rebuilt element renders identically. */
  check(
    at("E", "the element survives a prop change"),
    fresh ? m.svg.contains(fresh) : false,
    fresh && m.svg.contains(fresh) ? "the same <svg>" : "the <svg> was replaced",
  );

  /* E — teardown. */
  await m.unmount();
  await settle(2);
  check(
    at("F", "teardown leaves nothing behind"),
    !m.container.querySelector("svg"),
    m.container.querySelector("svg") ? "still mounted" : "unmounted",
  );

  /* G — a static blobatar is an `<img>`, which has no eyes to move. The binding
     must not start a driver on one.
     Asked about `--mo-track-x` rather than about the excursion, because the two
     say different things. The excursion is a declaration the caller asked for
     and is harmless anywhere; `--mo-track-x` is written by the driver itself,
     so finding one on an `<img>` means a frame loop is running for a picture
     that cannot change. */
  const aimed = m.img && m.img.style.getPropertyValue("--mo-track-x");
  check(
    at("G", "no driver on a static blobatar"),
    !!m.img && !aimed,
    m.img ? (aimed ? `a driver is writing ${aimed}` : "no driver") : "no <img> rendered",
  );
}
