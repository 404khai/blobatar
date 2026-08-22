/**
 * The endpoint, as a machine can read it.
 *
 * Generated from the parser's own tables rather than written beside them. That
 * is the whole design of this file: `expression` is an enum of
 * `Object.keys(EXPRESSIONS)`, `background` of `Object.keys(BACKGROUNDS)`, the
 * accepted parameter list is `KNOWN`, and the bounds are the same constants
 * `parseOptions` validates against. Adding a pose to the library and wiring it
 * into `params.ts` updates this spec in the same commit, without anybody
 * remembering to — which is the only way a published spec stays true. The test
 * asserts that correspondence rather than the contents of the enums.
 *
 * OpenAPI 3.1 rather than 3.0: it is JSON Schema 2020-12 proper, which is what
 * function-calling formats consume, and it is the version that can describe a
 * response body that is an image without inventing a wrapper for it.
 *
 * Everything here is a `GET` with no authentication, which is stated rather
 * than omitted — `security: []` is how a spec says "public", where an absent
 * security section only says nobody wrote one.
 */
import { VERSION } from "blobatar";
import { DOCS, ERROR_CODES } from "./errors";
import {
  BACKGROUNDS,
  EXPRESSIONS,
  GENERATIONS,
  IGNORED,
  MAX_NAME,
  MAX_SIZE,
  MAX_TITLE,
  MIN_SIZE,
} from "./params";

/** Where the spec is served, on both deployments. */
export const SPEC_PATH = "/openapi.json";

const ERROR_RESPONSE = (description: string) => ({
  description,
  content: {
    "application/json": { schema: { $ref: "#/components/schemas/Error" } },
    "text/plain": { schema: { type: "string" } },
  },
});

/**
 * The parameters, one description each.
 *
 * A description on every parameter is not decoration here: it is the text a
 * function-calling model reads to decide what to pass, and it is the only
 * place the two asymmetries of this endpoint are stated — `size` clamps where
 * everything else rejects, and `tone: 1` renders as `0`.
 */
const query = () => [
  {
    name: "size",
    in: "query",
    description: `Pixel size of the rendered SVG, ${MIN_SIZE}–${MAX_SIZE}. Clamped into range rather than rejected, because a blobatar at the wrong scale is fixable with CSS and a 400 is a broken image. Omit to let the consumer size it.`,
    required: false,
    schema: { type: "integer", minimum: MIN_SIZE, maximum: MAX_SIZE },
  },
  {
    name: "s",
    in: "query",
    description:
      "Gravatar's spelling of `size`, accepted so that moving an integration here is a host edit. Wins if both are present.",
    required: false,
    schema: { type: "integer", minimum: MIN_SIZE, maximum: MAX_SIZE },
  },
  {
    name: "background",
    in: "query",
    description:
      "Shape drawn behind the body. Omit or pass `none` for a transparent backdrop, which is the default — the body is the blobatar.",
    required: false,
    schema: { type: "string", enum: Object.keys(BACKGROUNDS) },
  },
  {
    name: "hue",
    in: "query",
    description:
      "Locks the colour in degrees, 0–360, so the name drives shape only. 360 is accepted alongside 0: hue is a circle and callers compute into it.",
    required: false,
    schema: { type: "number", minimum: 0, maximum: 360 },
  },
  {
    name: "tone",
    in: "query",
    description:
      "Locks the swatch as a 0–1 position in the tone set, pale to ink. The bands are half-open, so an exact 1 sits on the top edge and renders as 0 — pass 0.999 for ink.",
    required: false,
    schema: { type: "number", minimum: 0, maximum: 1 },
  },
  {
    name: "expression",
    in: "query",
    description:
      "A pose the blobatar holds. Decorative: it never adds a mark, so it does not reach assistive technology and does not change the accessible name.",
    required: false,
    schema: { type: "string", enum: Object.keys(EXPRESSIONS), default: "idle" },
  },
  {
    name: "title",
    in: "query",
    description: `Accessible name, ${MAX_TITLE} characters or fewer. Emitted as a <title> inside the SVG. Names who the blobatar stands for, not what it looks like.`,
    required: false,
    schema: { type: "string", maxLength: MAX_TITLE },
  },
  {
    name: "gen",
    in: "query",
    description:
      "Pins the shape vocabulary. A generation is one frozen name-to-blobatar mapping and is never retired, so a pinned URL cannot come back different — which is why pinned responses are cached for a year as immutable. Unpinned follows the current major.",
    required: false,
    schema: { type: "string", enum: Object.keys(GENERATIONS) },
  },
  ...IGNORED.map(name => ({
    name,
    in: "query",
    description:
      "Accepted for drop-in Gravatar compatibility and ignored: every string renders, so there is no missing avatar to fall back to and nothing above a G rating to filter. Do not send it in new code.",
    required: false,
    schema: { type: "string" },
  })),
];

/**
 * The spec, for one origin.
 *
 * Parameterised because the same endpoint runs on two deployments — the one at
 * blobatar.dev and whatever hostname a fork's `apps/api` lands on — and a
 * `servers` entry naming somebody else's domain is worse than none: a
 * generated client would call the wrong host.
 */
export function openapi(origin: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "blobatar",
      version: VERSION,
      summary: "Deterministic geometric avatars over HTTP.",
      description: [
        "One route renders an SVG avatar from any string — a username, a display name, an email, an id, or a Gravatar digest. The same name always renders the same blobatar within a generation, so a URL is a stable identity for a person and needs no storage behind it.",
        "",
        "Reach for it when an application needs an avatar for somebody who has not uploaded one, when it needs a deterministic placeholder that will not change between page loads, or as a drop-in for Gravatar: swap the host and keep the rest of the URL.",
        "",
        "No authentication, no accounts, no rate limit to negotiate. Responses are cacheable and safe to hotlink from an `<img>` tag.",
      ].join("\n"),
      license: { name: "MIT", identifier: "MIT" },
      contact: { name: "blobatar issues", url: "https://github.com/Alain00/blobatar/issues" },
    },
    externalDocs: { description: "Endpoint documentation", url: DOCS },
    servers: [{ url: origin }],
    // Public. Stated, rather than left out and inferred.
    security: [],
    paths: {
      "/avatar/{name}": {
        get: {
          operationId: "getAvatar",
          summary: "Render an avatar for a name",
          description:
            "Returns an SVG document. Names are NFC-normalized, trimmed and lowercased before hashing, so /avatar/Alain and /avatar/alain render the same blobatar — prefer one spelling, since each is cached separately. Responses carry an ETag and may be revalidated with If-None-Match.",
          parameters: [
            {
              name: "name",
              in: "path",
              required: true,
              description: `Anything that stands for somebody: a username, an email, an id, a Gravatar hash. ${MAX_NAME} characters or fewer after percent-decoding. A name containing a slash must be percent-encoded as %2F.`,
              schema: { type: "string", minLength: 1, maxLength: MAX_NAME },
              example: "alain@example.com",
            },
            ...query(),
          ],
          responses: {
            "200": {
              description: "The rendered blobatar.",
              headers: {
                ETag: {
                  description: "Hash of the body. Send it back as If-None-Match.",
                  schema: { type: "string" },
                },
                "Cache-Control": {
                  description:
                    "A day with a month of stale-while-revalidate, or a year immutable when the request pinned a generation.",
                  schema: { type: "string" },
                },
              },
              content: {
                "image/svg+xml": {
                  schema: { type: "string", contentMediaType: "image/svg+xml" },
                },
              },
            },
            "304": { description: "The ETag matched; the body is unchanged." },
            "400": ERROR_RESPONSE("A parameter or the name was rejected."),
            "405": ERROR_RESPONSE("The method was not GET or HEAD."),
          },
        },
      },
      "/avatar/": {
        get: {
          operationId: "getAvatarUsage",
          summary: "Human-readable usage for the avatar route",
          description:
            "The parameter list as plain text, for a person who has reached the endpoint with curl. Programs should read this spec instead.",
          responses: {
            "200": {
              description: "Usage text.",
              content: { "text/plain": { schema: { type: "string" } } },
            },
          },
        },
      },
      [SPEC_PATH]: {
        get: {
          operationId: "getOpenApiSpec",
          summary: "This document",
          description: "The OpenAPI description of this endpoint, as JSON.",
          responses: {
            "200": {
              description: "The spec.",
              content: { "application/json": { schema: { type: "object" } } },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        Error: {
          type: "object",
          description:
            "Every error this endpoint returns, when the request asked for JSON with an Accept header. Without one the same error is served as plain text.",
          required: ["error"],
          properties: {
            error: {
              type: "object",
              required: ["code", "message", "hint", "status", "documentation"],
              properties: {
                code: {
                  type: "string",
                  enum: [...ERROR_CODES],
                  description:
                    "The class of mistake, stable across releases. Branch on this rather than on the message.",
                },
                message: {
                  type: "string",
                  description:
                    "What was wrong with this request, in English. Names the offending value; expected to change.",
                },
                hint: {
                  type: "string",
                  description: "One imperative line describing how to fix the request.",
                },
                status: { type: "integer", description: "The HTTP status, repeated in the body." },
                documentation: { type: "string", format: "uri" },
              },
            },
          },
        },
      },
    },
  };
}

/** The spec as a response, for whichever origin the request arrived on. */
export function spec(request: Request): Response {
  const { origin } = new URL(request.url);
  return new Response(`${JSON.stringify(openapi(origin), null, 2)}\n`, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      // Readable from a browser tool or another origin's agent, like the
      // avatars themselves. A spec nobody can fetch cross-origin is a spec
      // nobody can generate a client from.
      "access-control-allow-origin": "*",
      "cache-control": "public, max-age=3600",
    },
  });
}
