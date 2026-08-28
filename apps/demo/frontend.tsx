import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";
import "blobatar/motion.css";
// Order here is not load-bearing — `candidates.css` outranks `motion.css` on
// specificity, deliberately, because Bun emits these two in opposite orders
// under `bun build` and under `bun --hot`. It sits beside the other stylesheets
// rather than inside `App.tsx` only so all three are visible in one place.
import "./candidates.css";
// Outranks `candidates.css` on specificity for the same reason that file
// outranks `motion.css`, and again not on order. See its header.
// The library's half of §4.5: the channel registrations, the translate on
// `.mo-eyes`, and the idle stand-down. Before `pointer.css`, which only adds
// the sphere cues on top and has to outrank it.
import "blobatar/gaze.css";
import "./pointer.css";
// No cascade argument to make: `data-cull` collides with nothing, and both rules
// are inert until the grid carries the attribute.
import "./offscreen.css";

createRoot(document.getElementById("root")!).render(<App />);
