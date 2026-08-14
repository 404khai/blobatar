import { describe, expect, test } from "bun:test";
import { motionVars } from "../src/animate";
import { avatar, _parts } from "../src/avatar";
import { traits } from "../src/traits";

const SEEDS = Array.from({ length: 300 }, (_, i) => `user-${i}`);

const ms = (v: string) => Number(v.replace("ms", ""));

describe("markup", () => {
  test("static output is untouched by the motion layer", () => {
    // The whole opt-in design rests on this: adding animation cost nothing to
    // the people who never asked for it.
    for (const s of SEEDS) {
      expect(avatar(s)).not.toContain("mo-");
      expect(avatar(s)).not.toContain("style=");
    }
  });

  test("animating nests the transform layers and marks each eye", () => {
    const { inner } = _parts("alain", { animate: "hover" });

    // One transform property per element, so hover-lift, breathe and bob need
    // three elements or they overwrite each other.
    expect(inner).toContain('<g class="mo-root"><g class="mo-breathe"><g class="mo-bob">');
    expect(inner.match(/class="mo-eye"/g)).toHaveLength(2);
  });

  test("both eyes share one group, so they glance together", () => {
    // Independent eye movement reads as a lazy eye instantly, so the saccade
    // layer has to sit on the shared group with blink underneath it.
    const { inner } = _parts("alain", { animate: "hover" });
    const group = inner.slice(inner.indexOf("mo-eyes"));
    expect(inner.match(/class="mo-eyes"/g)).toHaveLength(1);
    expect(group.match(/class="mo-eye"/g)).toHaveLength(2);
  });

  test("always mode is a class, not a second code path", () => {
    expect(_parts("alain", { animate: "always" }).inner).toContain('class="mo-root mo-always"');
  });

  test("the backdrop stays outside the motion wrapper", () => {
    // Wrapping at the parts level instead would breathe the plate along with
    // the body. `blob` is transparent by default, so this only shows up when
    // someone passes a background — which is exactly why it needs a test.
    const { inner } = _parts("alain", { animate: "hover", background: "square" });
    expect(inner.indexOf("<path")).toBeLessThan(inner.indexOf("mo-root"));
  });

  test("the title stays outside the motion wrapper", () => {
    const { inner } = _parts("alain", { animate: "hover", title: "Ada" });
    expect(inner).toStartWith("<title>Ada</title>");
  });

  test("markup stays balanced with the wrapper in place", () => {
    for (const s of SEEDS.slice(0, 50)) {
      const { inner } = _parts(s, { animate: "hover" });
      const open = (inner.match(/<(?!\/)[a-z]/g) ?? []).length;
      const close = (inner.match(/<\/[a-z]/g) ?? []).length + (inner.match(/\/>/g) ?? []).length;
      expect(open).toBe(close);
    }
  });
});

describe("timing", () => {
  test("delays are negative, so avatars start mid-cycle", () => {
    // A positive delay postpones the start instead of offsetting the phase:
    // the grid still opens in unison, after an awkward pause.
    for (const s of SEEDS) {
      const v = motionVars(traits(s));
      expect(ms(v["--mo-phase"]!)).toBeLessThanOrEqual(0);
      expect(ms(v["--mo-bob-phase"]!)).toBeLessThanOrEqual(0);
      expect(ms(v["--mo-blink-phase"]!)).toBeLessThanOrEqual(0);
    }
  });

  test("phases span their period and do not cluster", () => {
    // The failure this guards is a grid that breathes as one heartbeat.
    const buckets = new Set(
      SEEDS.map(s => Math.floor((-ms(motionVars(traits(s))["--mo-phase"]!) / 2800) * 10)),
    );
    expect(buckets.size).toBe(10);
  });

  test("breathe and bob drift independently", () => {
    // Sharing one offset keeps the two periods drifting apart but locks every
    // avatar into the same drift — unison again, one level up.
    const same = SEEDS.filter(s => {
      const v = motionVars(traits(s));
      return Math.abs(ms(v["--mo-phase"]!) / 2800 - ms(v["--mo-bob-phase"]!) / 3400) < 0.01;
    });
    expect(same.length).toBeLessThan(SEEDS.length * 0.05);
  });

  test("blink phase stays inside its own period", () => {
    for (const s of SEEDS) {
      const v = motionVars(traits(s));
      const period = ms(v["--mo-blink"]!);
      expect(period).toBeGreaterThanOrEqual(3500);
      expect(period).toBeLessThanOrEqual(6500);
      expect(-ms(v["--mo-blink-phase"]!)).toBeLessThanOrEqual(period);
    }
  });

  test("glance directions are never near zero", () => {
    // Drawn as magnitude × sign rather than as a symmetric jitter: a seed that
    // drew 0.02 would have eyes that technically animate and visibly do not.
    for (const s of SEEDS) {
      const v = motionVars(traits(s));
      expect(Math.abs(Number(v["--mo-look-x"]))).toBeGreaterThanOrEqual(1);
      expect(Math.abs(Number(v["--mo-look-y"]))).toBeGreaterThanOrEqual(0.8);
      expect(Math.abs(Number(v["--mo-look-x"]))).toBeLessThanOrEqual(2.2);
      expect(Math.abs(Number(v["--mo-look-y"]))).toBeLessThanOrEqual(1.7);
    }
  });

  test("glances go in every direction across a grid", () => {
    // One shared @keyframes walks one sequence of fixations, so the only thing
    // stopping 400 avatars looking the same way at the same moment is the sign
    // of these two. All four quadrants have to show up.
    const quadrants = new Set(
      SEEDS.map(s => {
        const v = motionVars(traits(s));
        return `${Number(v["--mo-look-x"]) > 0}${Number(v["--mo-look-y"]) > 0}`;
      }),
    );
    expect(quadrants.size).toBe(4);
  });

  test("saccade period is its own, not locked to blink", () => {
    for (const s of SEEDS) {
      const v = motionVars(traits(s));
      const period = ms(v["--mo-saccade"]!);
      expect(period).toBeGreaterThanOrEqual(4200);
      expect(period).toBeLessThanOrEqual(7600);
      expect(-ms(v["--mo-saccade-phase"]!)).toBeLessThanOrEqual(period);
    }
  });

  test("reading motion traits leaves every existing trait untouched", () => {
    // Trait keys are string-addressed, so this should hold by construction.
    // It is asserted anyway because it is the property the whole keyed-stream
    // design exists to provide, and a regression here reshuffles every avatar
    // that has ever been rendered.
    const geometry = (svg: string) => svg.match(/ d="[^"]+"|<circle[^/]+/g);

    for (const s of SEEDS.slice(0, 50)) {
      const before = avatar(s);
      motionVars(traits(s));
      expect(avatar(s)).toBe(before);
      // Same shapes, same numbers — the animated build differs only by the
      // wrapper and the eye class.
      expect(geometry(_parts(s, { animate: "hover" }).inner)).toEqual(geometry(before));
    }
  });
});
