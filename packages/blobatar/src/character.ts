import { makeBlobatar, type BlobatarOptions } from "./render";
import * as style from "./styles/character";

export type { BlobatarOptions };
export type { TraitOverrides } from "./traits";

/** The `character` variant only, for bundles that ship a single look. */
export const blobatar = makeBlobatar(style, "character");
