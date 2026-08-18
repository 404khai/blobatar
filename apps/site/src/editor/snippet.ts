/**
 * The generator.
 *
 * The snippet is the page's deliverable — the tuned blobatar on screen is the
 * demonstration, this is the thing you leave with — so this is the one piece
 * here with a correctness property worth pinning, and `snippet.test.ts` pins
 * it: paste the output, render it, get the blobatar that was on screen.
 *
 * Pure, and separate from the panel for exactly that reason. A generator living
 * inside the component would be testable only by rendering one.
 */
import { KEY_ORDER } from "./axes";
import { identifier, type Gen } from "@/generations";

export type Api = "react" | "string";
export type Motion = false | "hover" | "always";

export interface SnippetInput {
  api: Api;
  /** The name the preview is showing. Emitted literally — see `nameNote`. */
  name: string;
  /** The pinned traits. Empty means no `traits` at all in the output. */
  pinned: Record<string, number>;
  motion: Motion;
  /**
   * Which generation the preview is rendering.
   *
   * Emitted only when it is not the default. Pinning the default would be
   * harmless and is not free: it puts a second import in front of every reader
   * of a snippet that does not need one, and — for the caller who does want to
   * pin gen1 across a major — it is a decision that belongs to them rather than
   * a default this page silently makes. See ADR-0006.
   */
  gen: Gen;
}

/**
 * `shape` is a valid identifier and `"eye.gap"` is not.
 *
 * Quoting every key would be uniform and slightly uglier; both are defensible
 * and the rule is to pick one. This picks the one a person writing the object
 * by hand would produce, since looking hand-written is the whole brief.
 */
const bare = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

const key = (k: string) => (bare.test(k) ? k : JSON.stringify(k));

/**
 * Panel order, then anything else.
 *
 * The fallback is not dead code: it is what keeps an unknown key — one added to
 * `AXES` and forgotten here, or one restored from a config someone hand-edited
 * — in the output instead of silently dropped.
 */
function entries(pinned: Record<string, number>, gen: Gen) {
  const order = KEY_ORDER[gen];
  const known = order.filter(k => k in pinned);
  const rest = Object.keys(pinned).filter(k => !order.includes(k));
  return [...known, ...rest].map(k => [k, pinned[k]!] as const);
}

/**
 * JSX attribute strings are not JS strings — no backslash escapes — so a name
 * containing a quote cannot be written as `name="…"` at all. Fall through to an
 * expression container, where the JS literal `JSON.stringify` produces is
 * exactly right. Same helper as the hero's, same reason.
 */
const attr = (value: string) =>
  /["\\]/.test(value) ? `{${JSON.stringify(value)}}` : `"${value}"`;

/**
 * The name is emitted literally, and it has to be.
 *
 * A real call site says `name={user.email}`, and the temptation is to emit that
 * — but every axis left unpinned still comes from the name, so a snippet that
 * substitutes a variable for the string the preview used renders a different
 * blobatar. The literal is the honest output; the comment is what tells you
 * which half of it is yours to replace.
 */
const nameNote = "// everything below comes from the name unless it is pinned";

export function snippet({ api, name, pinned, motion, gen }: SnippetInput): string {
  const traits = entries(pinned, gen);
  const seed = name || "blobatar";
  const generation = identifier(gen);

  return api === "react"
    ? react(seed, traits, motion, generation)
    : string(seed, traits, motion, generation);
}

function react(
  seed: string,
  traits: (readonly [string, number])[],
  motion: Motion,
  generation: string | null,
) {
  const lines = [`import { Blobatar } from "blobatar/react";`];
  if (generation) lines.push(`import { ${generation} } from "blobatar/generation";`);
  // The trade the library documents, stated where it is taken rather than in
  // prose beside the box: animating is what moves the blobatar out of a single
  // `<img>` and into a dozen inline SVG nodes.
  if (motion)
    lines.push(
      `import "blobatar/motion.css"; // animate renders inline SVG, not one <img>`,
    );

  lines.push("");
  if (traits.length) lines.push(nameNote);

  lines.push(`<Blobatar`, `  name=${attr(seed)}`);
  // Above `traits`, because it is the wider statement: the generation decides
  // what the trait positions below even mean.
  if (generation) lines.push(`  generation={${generation}}`);

  // One key inline, several over lines. A person writing `{ shape: 0.14 }`
  // does not break it across four lines, and a person writing six of them does
  // not leave it on one.
  if (traits.length === 1) {
    const [k, v] = traits[0]!;
    lines.push(`  traits={{ ${key(k)}: ${v} }}`);
  } else if (traits.length) {
    lines.push(`  traits={{`);
    for (const [k, v] of traits) lines.push(`    ${key(k)}: ${v},`);
    lines.push(`  }}`);
  }

  if (motion) lines.push(`  animate="${motion}"`);
  lines.push(`/>;`);

  return lines.join("\n");
}

function string(
  seed: string,
  traits: (readonly [string, number])[],
  motion: Motion,
  generation: string | null,
) {
  const lines = [`import { blobatar } from "blobatar";`];
  if (generation) lines.push(`import { ${generation} } from "blobatar/generation";`);
  lines.push("");

  // `animate` is honored by `blobatar/react` only — the string API returns
  // static markup whatever it is passed. Dropping it silently on the way over
  // would make this snippet a quieter blobatar than the one on screen, so it is
  // dropped out loud.
  if (motion)
    lines.push(`// animate is a blobatar/react option — this renders static markup`);
  if (traits.length) lines.push(nameNote);

  // Named `seed` here where the component takes `name`: same value, and the
  // words differ because they are read in different positions. See CONTEXT.md.
  const call = `const svg = blobatar(${JSON.stringify(seed)}`;

  if (!traits.length && !generation) return [...lines, `${call});`].join("\n");

  lines.push(`${call}, {`);
  if (generation) lines.push(`  generation: ${generation},`);
  if (traits.length) {
    lines.push(`  traits: {`);
    for (const [k, v] of traits) lines.push(`    ${key(k)}: ${v},`);
    lines.push(`  },`);
  }
  lines.push(`});`);

  return lines.join("\n");
}
