# @blobatar/angular

Angular adapter for [blobatar](https://github.com/Alain00/blobatar) — deterministic
geometric avatars generated from any string. Built with modern Angular signals,
standalone components, SSR safety, dual-mode SVG/IMG rendering, and optional gaze tracking.

```sh
npm install @blobatar/angular blobatar
# or
pnpm add @blobatar/angular blobatar
# or
bun add @blobatar/angular blobatar
```

`blobatar` is a peer dependency: the adapter carries no renderer of its own.

```typescript
import { Component } from '@angular/core';
import { BlobatarComponent } from '@blobatar/angular';

@Component({
  selector: 'app-user',
  standalone: true,
  imports: [BlobatarComponent],
  template: `<blobatar [name]="user.email" [size]="48" />`
})
export class UserComponent {
  user = { email: 'user@example.com' };
}
```

Animated blobatars need the stylesheet, and render as inline SVG rather than an `<img>`:

```scss
@import 'blobatar/motion.css';
```

```html
<blobatar [name]="user.email" animate="hover" />
```

Full option reference lives in the [main README](https://github.com/Alain00/blobatar#readme).

## Following the pointer

The eyes can track the cursor via the `gaze` input signal:

```scss
@import 'blobatar/motion.css';
@import 'blobatar/gaze.css'; // required — the eyes hold still without it
```

```html
<blobatar [name]="user.email" [animate]="true" [gaze]="true" [size]="96" />
```

## License

MIT
