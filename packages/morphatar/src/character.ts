import { makeAvatar, type AvatarOptions } from "./render";
import * as style from "./styles/character";

export type { AvatarOptions };

/** The `character` variant only, for bundles that ship a single look. */
export const avatar = makeAvatar(style, "character");
