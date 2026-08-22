/**
 * The two dialects.
 *
 * What matters most here is the half that did not change: an `<img>`, a
 * browser and a bare `curl` must all still get the plain text they got before
 * JSON existed, because a caller that never asked for a new format must not be
 * handed one. Every test that asserts the JSON envelope has a sibling below
 * asserting the text is untouched.
 */
import { expect, test, describe } from "bun:test";
import { avatar } from "./avatar";
import { DOCS, ERROR_CODES } from "./errors";
import worker from "./index";

const ORIGIN = "https://blobatar.dev";
const json = { accept: "application/json" };
// What a browser and an <img> actually send. Neither names JSON.
const browser = { accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" };
const image = { accept: "image/avif,image/webp,*/*" };

const get = (path: string, headers?: Record<string, string>) =>
  avatar(new Request(ORIGIN + path, { headers }));

describe("errors as JSON, when asked for", () => {
  test("a rejected parameter carries a code, a hint and where to read more", async () => {
    const res = get("/avatar/alain?expresion=happy", json);
    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toBe("application/json; charset=utf-8");

    const { error } = await res.json();
    expect(error.code).toBe("unknown_parameter");
    expect(error.status).toBe(400);
    expect(error.message).toContain("expresion");
    expect(error.hint.length).toBeGreaterThan(10);
    expect(error.documentation).toBe(DOCS);
  });

  test("every code it can answer with is one the spec enumerates", async () => {
    const cases: [string, string][] = [
      ["/avatar/alain?expresion=happy", "unknown_parameter"],
      ["/avatar/alain?background=hexagon", "unknown_value"],
      ["/avatar/alain?hue=warm", "invalid_number"],
      ["/avatar/alain?tone=4", "out_of_range"],
      [`/avatar/alain?title=${"x".repeat(200)}`, "title_too_long"],
      ["/avatar/a/b", "name_has_slash"],
      ["/avatar/%", "name_encoding"],
      [`/avatar/${"x".repeat(300)}`, "name_too_long"],
    ];
    for (const [path, code] of cases) {
      const { error } = await get(path, json).json();
      expect(error.code).toBe(code);
      expect(ERROR_CODES).toContain(error.code);
    }
  });

  test("a write is a 405 that still says which methods work", async () => {
    const res = avatar(new Request(`${ORIGIN}/avatar/alain`, { method: "POST", headers: json }));
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("GET, HEAD");
    expect((await res.json()).error.code).toBe("method_not_allowed");
  });

  test("a path the standalone deployment does not serve is a 404 with a code", async () => {
    const res = worker.fetch(new Request(`${ORIGIN}/avatars`, { headers: json }));
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("not_found");
  });

  /**
   * `Vary` rather than nothing, on a response that is already `no-store`.
   *
   * The header is what keeps the negotiation safe if the caching policy ever
   * moves: two bodies at one URL, chosen by a request header, is precisely the
   * shape a shared cache gets wrong.
   */
  test("says it varies on Accept", () => {
    expect(get("/avatar/alain?hue=warm", json).headers.get("vary")).toBe("accept");
    expect(get("/avatar/alain?hue=warm").headers.get("vary")).toBe("accept");
  });
});

describe("errors as text, for everything that did not ask", () => {
  test("a bare request still gets the message and the usage", async () => {
    const body = await get("/avatar/alain?hue=warm").text();
    expect(body).toContain('hue must be a number, got "warm"');
    expect(body).toContain("GET /avatar/<name>");
  });

  test("a browser and an <img> get text, not JSON", async () => {
    for (const headers of [browser, image]) {
      const res = get("/avatar/alain?hue=warm", headers);
      expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
      expect(await res.text()).toContain("GET /avatar/<name>");
    }
  });

  test("the 405 body is still one line rather than the whole usage", async () => {
    const res = avatar(new Request(`${ORIGIN}/avatar/alain`, { method: "PUT" }));
    expect(await res.text()).toBe("PUT not allowed");
  });
});
