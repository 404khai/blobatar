/**
 * `@blobatar/angular` — the Angular adapter.
 *
 * ```ts
 * import { Blobatar } from "@blobatar/angular";
 *
 * @Component({
 *   imports: [Blobatar],
 *   template: `<blobatar [name]="user.email" [size]="48" />`,
 * })
 * ```
 */

export { Blobatar } from "./blobatar.component";
export type { Animate, BlobatarOptions, Expression } from "blobatar/internal";
