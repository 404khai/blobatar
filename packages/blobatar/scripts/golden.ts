/**
 * Writes the golden fixture.
 *
 * Deliberately not part of `check`, and deliberately requiring `--write`. The
 * failure mode this guards against is the ordinary one: a threshold moves, the
 * golden test goes red, and the quickest way to green is to regenerate. That
 * would turn the only check on the library's central promise into a formality.
 *
 * Regenerating is correct in exactly two situations — recording a brand new
 * generation, and a change that provably cannot alter output — and both are
 * things somebody should have to type a flag to say.
 */

import { cases, histogram, markup } from "../test/golden/corpus";
import { hash, serialize } from "../test/golden/format";

const FIXTURE = "test/golden/gen1.txt";

if (!process.argv.includes("--write")) {
  console.error(
    `Refusing to write without --write.\n\n` +
      `  A diff in ${FIXTURE} is a breaking change, not a test to update.\n` +
      `  If a seed's markup moved, fix the code. If the move is intended,\n` +
      `  it belongs in a new generation.\n\n` +
      `  bun scripts/golden.ts --write`,
  );
  process.exit(1);
}

const hashes = [...cases()].map(([label, svg]) => [label, hash(svg)] as [string, string]);

const text = serialize({
  histogram: histogram(),
  markup: markup(),
  hashes,
});

await Bun.write(FIXTURE, text);

console.log(
  `✓ ${FIXTURE}\n` +
    `  ${hashes.length} hashed cases, ${markup().length} full renders, ` +
    `${(text.length / 1024).toFixed(1)} KB`,
);
