import { createRoot } from "react-dom/client";
import { App } from "./src/App";
// Required — nothing animates without it, and the hero is `animate="always"`.
//
// Imported *before* the page's own stylesheet, and the order is load-bearing:
// `styles.css` cancels the library's hover reaction, and both rules are
// unlayered and equally specific, so the later file is the one that wins.
import "blobatar/motion.css";
import "./styles.css";

createRoot(document.getElementById("root")!).render(<App />);
