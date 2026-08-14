import { avatar, type AvatarOptions } from "./avatar";

/**
 * A `data:` URI suitable for `<img src>` or `background-image`.
 *
 * Percent-encoded rather than base64: base64 inflates payloads ~33%, while SVG
 * markup is mostly characters that survive percent-encoding untouched. Only the
 * characters that actually break inside an attribute are escaped.
 */
export function avatarUri(seed: string, opts?: AvatarOptions): string {
  const svg = avatar(seed, opts)
    .replace(/"/g, "'")
    .replace(/[%#<>{}|\\^[\]`]/g, c => "%" + c.charCodeAt(0).toString(16).toUpperCase());
  return "data:image/svg+xml," + svg.replace(/\s+/g, " ");
}
