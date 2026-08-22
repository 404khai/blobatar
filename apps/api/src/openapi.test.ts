/**
 * The spec, against the parser it describes.
 *
 * Nothing here asserts what the enums contain — that would be a second copy of
 * `params.ts` with the same drift problem the generation exists to remove.
 * What it asserts is the correspondence: every parameter the parser accepts is
 * described, every value it accepts is offered, and nothing is described that
 * the parser would reject. A pose added to the library and wired into
 * `params.ts` passes this file; one wired in and forgotten does not.
 */
import { expect, test, describe } from "bun:test";
import { ERROR_CODES } from "./errors";
import { openapi, spec, SPEC_PATH } from "./openapi";
import { BACKGROUNDS, EXPRESSIONS, GENERATIONS, KNOWN } from "./params";
import worker from "./index";

const document = openapi("https://blobatar.dev");
const operations = Object.entries(document.paths).flatMap(([path, item]) =>
  Object.entries(item as Record<string, any>).map(([method, op]) => ({ path, method, op })),
);
const getAvatar = document.paths["/avatar/{name}"].get;
const params = getAvatar.parameters;
const named = (name: string) => params.find((p: any) => p.name === name);

describe("the spec describes the parser", () => {
  test("every accepted query parameter appears, and nothing else does", () => {
    const described = params.filter((p: any) => p.in === "query").map((p: any) => p.name);
    expect([...described].sort()).toEqual([...KNOWN].sort());
  });

  test("the enumerated parameters offer exactly the values the parser takes", () => {
    expect(named("expression").schema.enum).toEqual(Object.keys(EXPRESSIONS));
    expect(named("background").schema.enum).toEqual(Object.keys(BACKGROUNDS));
    expect(named("gen").schema.enum).toEqual(Object.keys(GENERATIONS));
  });

  test("the error schema enumerates every code the endpoint can answer with", () => {
    expect(document.components.schemas.Error.properties.error.properties.code.enum).toEqual([
      ...ERROR_CODES,
    ]);
  });

  test("the name is a required path parameter with the parser's own length cap", () => {
    expect(named("name").in).toBe("path");
    expect(named("name").required).toBe(true);
    expect(named("name").schema.maxLength).toBe(256);
  });
});

/**
 * The properties a function-calling format needs, checked as properties rather
 * than one at a time: an operation without a unique id cannot be addressed, and
 * a parameter without a description is one a model has to guess at.
 */
describe("the spec is callable by a model", () => {
  test("every operation has a unique operationId", () => {
    const ids = operations.map(({ op }) => op.operationId);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("every operation has a summary and a description", () => {
    for (const { op } of operations) {
      expect(op.summary).toBeString();
      expect(op.description.length).toBeGreaterThan(40);
    }
  });

  test("every parameter is typed and described", () => {
    for (const parameter of params) {
      expect(parameter.description.length).toBeGreaterThan(20);
      expect(parameter.schema.type).toBeString();
    }
  });

  test("every response documents a media type or is a 304", () => {
    for (const { op } of operations) {
      for (const [status, response] of Object.entries<any>(op.responses)) {
        if (status === "304") continue;
        expect(Object.keys(response.content).length).toBeGreaterThan(0);
      }
    }
  });

  test("says it is public rather than leaving authentication unstated", () => {
    expect(document.security).toEqual([]);
  });
});

describe("serving it", () => {
  test("names the origin it was fetched from, not a hardcoded host", async () => {
    const fork = "https://blobatar-api.someone.workers.dev";
    const res = worker.fetch(new Request(fork + SPEC_PATH));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect((await res.json()).servers).toEqual([{ url: fork }]);
  });

  test("is readable cross-origin, since that is where a client is generated", () => {
    const res = spec(new Request("https://blobatar.dev" + SPEC_PATH));
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });
});
