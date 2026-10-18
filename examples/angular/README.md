# @blobatar/angular example

An Angular 19 app with SSR, for trying `@blobatar/angular` the way a consumer
installs it. One page covers static avatars, options, animation, expressions
and gaze.

It is not a workspace member. It installs the two packages from tarballs packed
out of this checkout, so it exercises what would actually be published.

## Run it

From this directory:

```sh
bun run vendor     # build + pack blobatar and @blobatar/angular into vendor/
npm install
npm start          # http://localhost:4200
```

After changing either package, rerun `bun run vendor`, then `npm install`.

To check server rendering, `npm run build` prerenders the page, and
`npm run serve:ssr:angular-demo` serves the SSR build.

## What to look for

- **Static:** every avatar is an `<img>` with an SVG data URI.
- **Animated:** these render as inline `<svg>`. Toggling `animate` swaps the element.
- **Expressions:** switching moves the face smoothly. The root `<g>` stays the
  same element, so it doesn't jump.
- **Gaze:** the first face follows the pointer. The second looks at whichever
  input has focus.
- **SSR:** in the prerendered `dist/angular-demo/browser/index.html`, animated
  blobatars are already drawn, and the hostile `title` is escaped.
