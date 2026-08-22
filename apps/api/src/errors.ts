/**
 * The endpoint's errors, in the dialect the caller asked for.
 *
 * This endpoint's first-class client is an `<img>` tag, and its second is a
 * person pasting a URL into a terminal. Both are served best by plain text: a
 * broken image plus a body that says which parameter was wrong is diagnosable
 * with `curl` and nothing else, and that is what shipped.
 *
 * Its third client turned out to be a program. An agent calling this from a
 * tool definition cannot act on a paragraph of English — it needs something to
 * branch on, and a hint that names the fix. So errors are content-negotiated
 * rather than converted: `Accept: application/json` gets the envelope below,
 * everything else gets the text it has always got, byte for byte.
 *
 * Negotiated on `Accept` rather than on a `?format=` parameter deliberately.
 * The parser rejects unknown parameters — that strictness is the reason
 * `?expresion=happy` is a 400 rather than a silently wrong face — so a format
 * parameter would have to be carved out of it, and it would then appear in
 * cache keys for every URL that never used it.
 */

/**
 * What went wrong, as something stable enough to branch on.
 *
 * These are part of the contract in a way the messages are not: a message says
 * which value was wrong in this request and is expected to change, a code
 * names the class of mistake and is not. Adding a member is additive; renaming
 * one is a breaking change to the endpoint.
 */
export const ERROR_CODES = [
  "bad_request",
  "unknown_parameter",
  "unknown_value",
  "invalid_number",
  "out_of_range",
  "title_too_long",
  "name_empty",
  "name_has_slash",
  "name_encoding",
  "name_too_long",
  "method_not_allowed",
  "not_found",
] as const;

/** A value at runtime as well as a type, so `openapi.ts` can enumerate the
 * codes into the schema rather than keeping a second list of them. */
export type ErrorCode = (typeof ERROR_CODES)[number];

/**
 * Where the fix is written down.
 *
 * blobatar.dev rather than the deployment's own origin, and that is deliberate
 * for the fork case: `apps/api` deploys on anybody's account, and a hint
 * pointing at a `workers.dev` subdomain that hosts no documentation helps
 * nobody. The docs are the same for every deployment because the endpoint is.
 */
export const DOCS = "https://blobatar.dev/docs";

/**
 * How to fix it, per code.
 *
 * One line, imperative, and about the *request* rather than about the endpoint.
 * "Percent-encode the slash as %2F" is a thing a caller can do; "names may not
 * contain slashes" is the message it already has.
 */
const HINTS: Record<ErrorCode, string> = {
  bad_request: `Check the request against the parameter list at ${DOCS}.`,
  unknown_parameter:
    "Remove the parameter or correct its spelling. The accepted names are listed in the message and in /openapi.json.",
  unknown_value:
    "Use one of the values named in the message. They are enumerated per parameter in /openapi.json.",
  invalid_number: "Send a plain decimal number, with no units and no whitespace.",
  out_of_range: "Bring the value inside the range named in the message before sending it.",
  title_too_long:
    "Shorten the title. It becomes the blobatar's accessible name, so it wants a name rather than a sentence.",
  name_empty: "Put a name after /avatar/, for example /avatar/alain.",
  name_has_slash: "Percent-encode the slash as %2F.",
  name_encoding:
    "Build the path with encodeURIComponent, which escapes the characters a bare % leaves malformed.",
  name_too_long:
    "Hash the identifier before using it as a name — a digest is a stable seed and always fits.",
  method_not_allowed: "Repeat the request as GET or HEAD.",
  not_found: "The only route is GET /avatar/<name>. See /openapi.json for its parameters.",
};

/** The JSON body, as the one shape every error here comes out in. */
export interface ErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    hint: string;
    status: number;
    documentation: string;
  };
}

export const errorBody = (
  status: number,
  code: ErrorCode,
  message: string,
): ErrorBody => ({
  error: { code, message, hint: HINTS[code], status, documentation: DOCS },
});

/**
 * Whether the caller asked for JSON.
 *
 * A substring check on `Accept`, not a full negotiation, and the asymmetry is
 * on purpose: a browser asks for HTML and a wildcard, an `<img>` asks for the
 * image formats and a wildcard, and neither names JSON — so text stays the
 * default for everything that has not asked, a bare wildcard included. Only a
 * caller that spelled out `application/json` (or any `+json` profile) changes
 * dialect, which is exactly the caller that can parse one.
 */
export function wantsJson(request: Request): boolean {
  const accept = request.headers.get("accept") ?? "";
  return accept.includes("application/json") || accept.includes("+json");
}
