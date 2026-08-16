import { makeBlobatar, type BlobatarOptions } from "./render";
import * as style from "./styles/blob";

export type { BlobatarOptions };
export type { Shape } from "./styles/blob";
export type { TraitOverrides } from "./traits";

/** The `blob` variant only, for bundles that ship a single look. */
export const blobatar = makeBlobatar(style, "blob");

/**
 * The numeric layout for a set of traits, without resolving a palette or
 * rendering. Exposed for callers that need a seed's `shape` in bulk — filtering
 * thousands of seeds down to the rare silhouettes costs a hash and some
 * arithmetic this way, where going through `_layout` would also resolve an
 * OKLCh palette per candidate.
 */
export { layout } from "./styles/blob";
