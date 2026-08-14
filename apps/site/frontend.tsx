import { createRoot } from "react-dom/client";
import { App } from "./src/App";
import "./styles.css";
// Required — nothing animates without it, and the hero is `animate="always"`.
import "morphatar/motion.css";

createRoot(document.getElementById("root")!).render(<App />);
