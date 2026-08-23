/**
 * Teaches Bun to load `@blobatar/react-native` at all.
 *
 * This is the same job `svelte-plugin.ts` does, for the same reason and with a
 * different obstacle. There, the published artifact is source and the consumer
 * owns the compiler. Here, the adapter's substrate is a *native* module:
 * `react-native-svg`'s entry reaches into `react-native`, whose own entry is
 * Flow-typed source — `import typeof * as ReactNativePublicAPI from
 * './index.js.flow'` — which Bun cannot parse and never will, because Flow is
 * not a thing Bun implements. There is no flag that fixes it.
 *
 * So the four components the adapter draws with are replaced by host elements
 * of the same name, and the adapter renders through `react-dom/server` into
 * markup the rest of this suite can already read.
 *
 * ## What this can and cannot prove, stated rather than assumed
 *
 * The adapter's whole job is choosing which props go on which `react-native-svg`
 * component. A stub records exactly that, faithfully, because the props pass
 * through untouched — so every assertion about the *picture* is as real here as
 * it is for React or Vue.
 *
 * What it cannot prove is that `react-native-svg` accepts those props, since a
 * stub accepts anything. That half is covered somewhere else and deliberately:
 * `packages/react-native` typechecks against the library's real `SvgProps` and
 * element declarations, so a renamed or misspelled prop is a build error there.
 * Types from the real package, behavior from the stub.
 *
 * Neither of those proves it *draws* on a device, and nothing in a test runner
 * can. `apps/example-native` exists for that, run by hand — because "the
 * elements are right" is the exact level of confidence that shipped an adapter
 * rendering an empty string once already (ADR-0009).
 *
 * ## Why lowercase tags
 *
 * `Svg` → `svg`, `Path` → `path`, and so on, so `react-dom/server` emits the
 * same element names core's string renderer does and the existing comparison
 * helpers work unchanged. The mapping is four lines and it is the one thing in
 * this file that could be wrong without a test noticing — which is why it is
 * four lines of nothing but a rename, and why the props are never touched.
 *
 * ## Why the root's props are recorded as well as rendered
 *
 * `react-dom` serializes an unknown attribute only when its value is a string
 * or a number, and drops it silently when it is a boolean — so
 * `accessibilityElementsHidden={true}`, which is exactly the React Native API,
 * never reaches the markup. Asserting accessibility against HTML would quietly
 * be asserting against react-dom's attribute rules instead of against the
 * adapter.
 *
 * So the stubbed root pushes the props it was handed onto `received`, whole and
 * untouched. That is the honest instrument for "which props did the adapter
 * choose", and it is unaffected by how anything downstream spells them.
 * Geometry still goes through the markup, because geometry is what has to match
 * another adapter's.
 *
 * Only the three attributes that describe the drawing surface are then handed
 * to `react-dom`. The React Native ones are deliberately withheld: passing them
 * on would print a "React does not recognize the prop" warning per assertion,
 * and a suite that warns constantly is a suite where a real warning is
 * invisible. Nothing reads them from the markup anyway — `received` is where
 * they are asserted.
 */

import { plugin } from "bun";

plugin({
  name: "react-native-svg stub",
  setup(build) {
    build.module("react-native-svg", () => ({
      loader: "js",
      contents: `
        import { createElement } from "react";
        const mk = (tag) => {
          const C = (props) => createElement(tag, props);
          C.displayName = tag;
          return C;
        };
        export const received = [];
        export const Svg = (props) => {
          received.push(props);
          const { viewBox, width, height, children } = props;
          return createElement("svg", { viewBox, width, height }, children);
        };
        Svg.displayName = "svg";
        export const Path = mk("path");
        export const Circle = mk("circle");
        export const G = mk("g");
        export default Svg;
      `,
    }));
  },
});
