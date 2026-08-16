import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import { App } from "./src/App";
// Required — nothing animates without it, and the hero is `animate="always"`.
//
// Imported *before* the page's own stylesheet, and the order is load-bearing:
// `styles.css` cancels the library's hover reaction, and both rules are
// unlayered and equally specific, so the later file is the one that wins.
import "blobatar/motion.css";
import "./styles.css";

// `<Analytics />` renders nothing — it injects Vercel's `/_vercel/insights`
// script, which only exists once the site is deployed. Locally it falls back to
// the debug script and logs to the console instead of sending anything.
createRoot(document.getElementById("root")!).render(
  <>
    <App />
    <Analytics />
  </>,
);
