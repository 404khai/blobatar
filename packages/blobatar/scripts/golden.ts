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

import { RECORDED, cases, histogram, markup } from "../test/golden/corpus";
import { hash, serialize } from "../test/golden/format";

const DIR = "test/golden";

if (!process.argv.includes("--write")) {
  console.error(
    `Refusing to write without --write.\n\n` +
      `  A diff in ${DIR}/*.txt is a breaking change, not a test to update.\n` +
      `  If a seed's markup moved, fix the code. If the move is intended,\n` +
      `  it belongs in a new generation.\n\n` +
      `  bun scripts/golden.ts --write`,
  );
  process.exit(1);
}

// Every recorded generation, every time. Writing one at a time would make it
// possible to add a generation and leave an older fixture half-regenerated
// against a shared change — the one direction this script is not able to catch.
for (const { gen, file } of RECORDED) {
  const path = `${DIR}/${file}.txt`;
  const hashes = [...cases(gen)].map(([label, svg]) => [label, hash(svg)] as [string, string]);
  const renders = markup(gen);

  const text = serialize(
    { histogram: histogram(gen), markup: renders, hashes },
    file,
  );

  await Bun.write(path, text);

  console.log(
    `✓ ${path}\n` +
      `  ${hashes.length} hashed cases, ${renders.length} full renders, ` +
      `${(text.length / 1024).toFixed(1)} KB`,
  );
}
