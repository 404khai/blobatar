import { createRoot, hydrateRoot } from "react-dom/client";
import { App } from "./src/App";
// Required — nothing animates without it, and the hero is `animate="always"`.
//
// Imported *before* the page's own stylesheet, and the order is load-bearing:
// `styles.css` cancels the library's hover reaction, and both rules are
// unlayered and equally specific, so the later file is the one that wins.
import "blobatar/motion.css";
import "./styles.css";

// Nothing here injects an analytics script. Cloudflare Web Analytics is
// enabled on the zone and its beacon is inserted at the edge, so the measuring
// costs this bundle nothing and there is no token to keep in the repo.
const root = document.getElementById("root")!;

const tree = <App />;

/*
 * Which of the two depends on who served the page, and the check is for markup
 * rather than for a build flag because that is the thing that actually differs.
 *
 * `build.ts` prerenders `<App />` into `#root`, so in production the markup is
 * already there and hydrating adopts it. The dev server has no prerender step —
 * it hands over `index.html` as authored, with an empty root — and hydrating
 * that logs "server rendered HTML didn't match" on every reload. React recovers
 * by rendering client-side anyway, which is the right result reached by way of
 * an error message, and an error you are trained to ignore is worse than no
 * error at all.
 */
if (root.firstChild) hydrateRoot(root, tree);
else createRoot(root).render(tree);
