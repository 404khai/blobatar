import { serve } from "bun";
import index from "./demo/index.html";

const server = serve({
  routes: { "/*": index },
  development: process.env.NODE_ENV !== "production" && { hmr: true, console: true },
});

console.log(`morphatar tuning grid → ${server.url}`);
