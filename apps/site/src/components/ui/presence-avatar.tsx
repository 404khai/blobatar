/**
 * The published item, under the alias it is published at.
 *
 * `registry/` holds the sources `shadcn build` inlines into `public/r`, and
 * they are authored against the *consumer's* aliases: `@/components/ui/…`,
 * which the CLI rewrites on install. This app happens to declare the same
 * alias, so a one-line re-export here makes those imports resolve in two
 * places at once. `registry/agent-list.tsx` imports this path and gets the
 * real file; the showcase page imports this path and renders the exact bytes
 * a `shadcn add` would copy.
 *
 * That last part is the reason to do it this way rather than keep a prettier
 * copy of each component in `src/`. A gallery whose demos are re-implementations
 * of the things it is advertising is a gallery that goes quietly wrong.
 */
export * from "../../../registry/presence-avatar";
