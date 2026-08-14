import { makeAvatar, type AvatarOptions } from "./render";
import * as style from "./styles/blob";

export type { AvatarOptions };
export type { Shape } from "./styles/blob";

/** The `blob` variant only, for bundles that ship a single look. */
export const avatar = makeAvatar(style, "blob");
