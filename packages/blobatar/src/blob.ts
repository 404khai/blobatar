import { gen2 } from "./generation";
import { makeBlobatar, type BlobatarOptions } from "./render";
import type { Layout } from "./styles/compose";
import type { Traits } from "./traits";

export type { BlobatarOptions };
export type { TraitOverrides } from "./traits";

/**
 * Every silhouette name the package's own generations use.
 *
 * gen1's six plus gen2's four. A union of both rather than of the default
 * alone, because the default moved once (at `2.0.0`) and will move again — a
 * type that tracked it would be a breaking change on every major, for callers
 * whose code did not change.
 *
 * Hand-written rather than derived, because a composed `layout` returns
 * `shape: string` — which names are possible is a property of the band table,
 * and the composer cannot see it. Kept as a union anyway: the callers this
 * exists for are filtering bulk seeds *for* a named silhouette, and `string`
 * would let a typo through silently.
 *
 * A consumer-composed generation can name silhouettes outside this union; its
 * own `layout` is typed `shape: string` and this is not a claim about it.
 */
export type ShapeName =
  | "round" | "boxy" | "organic" | "cloud" | "sun" | "nub"
  | "capsule" | "triangle" | "hexagon" | "droplet";

/**
 * @deprecated Renamed to {@link ShapeName}, which says what it is — the *name*
 * of a silhouette, not a silhouette. `Shape` now means the silhouette value
 * itself, exported from `blobatar/shapes`. This alias stays so the rename costs
 * no consumer anything; it is a type, so it costs no bytes either.
 */
export type Shape = ShapeName;

/**
 * The renderer alone, without the colour and trait utilities the barrel also
 * carries. Import this when all you do is render.
 */
export const blobatar = makeBlobatar(gen2);

/**
 * The numeric layout for a set of traits, without resolving a palette or
 * rendering. Exposed for callers that need a seed's `shape` in bulk — filtering
 * thousands of seeds down to the rare silhouettes costs a hash and some
 * arithmetic this way, where going through `_layout` would also resolve an
 * OKLCh palette per candidate.
 *
 * This is the *default* generation's layout — gen2 as of `2.0.0`, gen1 before
 * it. It does not follow `opts.generation`, because it takes no options: a bulk
 * filter names the vocabulary it is filtering for, and a caller who wants
 * another generation's layout reads it off that generation. `gen1.layout` and
 * `gen2.layout` are both public on `blobatar/generation` and always will be.
 *
 * **This changed at `2.0.0`.** It was gen1's, because gen1 was the default;
 * code filtering for `"cloud"` will now also meet `"droplet"`. Pin `gen1` and
 * read `gen1.layout` to keep the old behaviour exactly.
 *
 * The cast is the one place the narrower `shape` type is asserted rather than
 * inferred, and it is sound by the same thing that makes it necessary: the band
 * tables in `generation.ts` name exactly these silhouettes, and the golden
 * fixtures freeze that they always will.
 */
export const layout = gen2.layout as (
  t: Traits,
) => Omit<Layout, "shape"> & { shape: ShapeName };
