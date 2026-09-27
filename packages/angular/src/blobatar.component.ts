import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  input,
  viewChild,
  type OnDestroy,
  type Signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { blobatarUri } from 'blobatar/uri';
import { _parts, serializeVars, type Animate } from 'blobatar/internal';
import { gaze as initGaze, type Gaze } from 'blobatar/gaze';
import {
  happy,
  idle,
  love,
  mad,
  sad,
  scared,
  shy,
  sick,
  sleepy,
  smug,
  surprised,
  thinking,
  unsure,
  wink,
  type Expression,
} from 'blobatar/expression';

export interface BlobatarParts {
  cls?: string;
  bg?: { d: string; fill: string };
  inner: string;
  vars?: Record<string, string>;
}

export const BLOBATAR_EXPRESSIONS: Record<string, Expression> = {
  happy,
  idle,
  love,
  mad,
  sad,
  scared,
  shy,
  sick,
  sleepy,
  smug,
  surprised,
  thinking,
  unsure,
  wink,
};

export const EXPRESSIONS = BLOBATAR_EXPRESSIONS;

export type BlobatarExpressionName = keyof typeof BLOBATAR_EXPRESSIONS;
export type ExpressionName = BlobatarExpressionName;

export type BlobatarBackgroundShape = 'squircle' | 'circle' | 'square' | boolean;

export interface BlobatarPalette {
  head?: string;
  eye?: string;
  bg?: string;
}

export interface BlobatarConfig {
  seed?: string;
  name?: string;
  size?: number;
  palette?: BlobatarPalette;
  background?: BlobatarBackgroundShape;
  hue?: number;
  tone?: number;
  traits?: Record<string, any>;
  expression?: Expression | BlobatarExpressionName | string;
  animated?: boolean | 'always' | 'hover';
  animate?: boolean | 'always' | 'hover';
  gazeTracking?: boolean | 'pointer';
  gaze?: boolean | 'pointer';
  drops?: boolean;
  bgColor?: string;
  bg?: string;
  backgroundColor?: string;
}

export type BlobatarPreset = BlobatarConfig;
export type BlobatarCustomConfig = BlobatarConfig;

@Component({
  selector: 'blobatar, app-blobatar, [blobatar]',
  standalone: true,
  template: `
    @if (isBrowser) {
      @if (isAnimated()) {
        <svg
          #svgElement
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 100 100"
          [attr.width]="effectiveSize()"
          [attr.height]="effectiveSize()"
          [attr.role]="title() ? 'img' : null"
          [attr.aria-hidden]="title() ? null : 'true'"
          [attr.style]="svgStyle()"
          [attr.class]="svgClassesString()"
        >
          @if (title()) {
            <title>{{ title() }}</title>
          }
          @if (parts()?.bg; as bg) {
            <path [attr.d]="bg.d" [attr.fill]="bg.fill" />
          }
          @if (effectiveDrops()) {
            <g class="canvas-paint-drops" opacity="0.95">
              <circle cx="18" cy="22" r="3.6" fill="#ec4899" />
              <path d="M18 16 C18 16 20.6 19.5 20.6 22 A2.6 2.6 0 0 1 15.4 22 C15.4 19.5 18 16 18 16 Z" fill="#ec4899" />
              <circle cx="82" cy="24" r="3.2" fill="#0ea5e9" />
              <path d="M82 19 C82 19 84.4 22 84.4 24 A2.4 2.4 0 0 1 79.6 24 C79.6 22 82 19 82 19 Z" fill="#0ea5e9" />
              <circle cx="17" cy="78" r="2.8" fill="#f59e0b" />
              <circle cx="23" cy="83" r="1.5" fill="#f59e0b" />
              <circle cx="83" cy="76" r="3.5" fill="#10b981" />
              <path d="M83 70 C83 70 86 73.5 86 76 A3 3 0 0 1 80 76 C80 73.5 83 70 83 70 Z" fill="#10b981" />
            </g>
          }
          @if (parts(); as p) {
            <g [class]="p.cls" [innerHTML]="sanitizedInner()"></g>
          }
          <ng-content />
        </svg>
      } @else {
        <img
          [src]="staticUri()"
          [attr.width]="effectiveSize()"
          [attr.height]="effectiveSize()"
          [attr.alt]="alt() || title() || ''"
          [attr.class]="svgClassesString()"
        />
      }
    } @else {
      <span
        class="blobatar-ssr-frame"
        style="display:inline-flex;line-height:0"
        [innerHTML]="serverHtml()"
      ></span>
    }
  `,
  styles: [`
    :host {
      display: inline-flex;
      vertical-align: middle;
      line-height: 0;
    }

    svg, img {
      display: block;
      flex-shrink: 0;
      border-radius: var(--blobatar-radius, 50%);
      transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease;
    }

    .blobatar-square {
      border-radius: var(--blobatar-radius, 10%);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06), inset 0 0 0 1px rgba(0, 0, 0, 0.08);
    }

    .blobatar-squircle {
      border-radius: var(--blobatar-radius, 22%);
    }

    .blobatar-circle {
      border-radius: var(--blobatar-radius, 50%);
    }

    .blobatar-transparent {
      border-radius: var(--blobatar-radius, 0);
      overflow: visible;
    }

    .blobatar-animated:hover {
      transform: scale(1.08) rotate(-2deg);
    }

    .blobatar-gaze {
      --mo-track-travel: 6px;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlobatarComponent implements OnDestroy {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly platformId = inject(PLATFORM_ID);
  readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly svgElementRef = viewChild<ElementRef<SVGSVGElement>>('svgElement');
  private gazeDriver?: Gaze;

  // Preset configuration input
  readonly config = input<BlobatarCustomConfig | undefined>(undefined);

  // Identity inputs
  readonly name = input<string | undefined>(undefined);
  readonly seed = input<string | undefined>(undefined);
  readonly effectiveSeed = computed(() => {
    return this.seed() ?? this.name() ?? this.config()?.seed ?? this.config()?.name ?? 'blobatar';
  });

  // Presentation inputs
  readonly size = input<number | undefined>(undefined);
  readonly effectiveSize = computed(() => this.size() ?? this.config()?.size ?? 36);

  readonly animate = input<boolean | 'always' | 'hover' | undefined>(undefined);
  readonly animated = input<boolean | 'always' | 'hover' | undefined>(undefined);
  readonly effectiveAnimate = computed(() => {
    return this.animate() ?? this.animated() ?? this.config()?.animate ?? this.config()?.animated ?? false;
  });

  readonly expression = input<Expression | BlobatarExpressionName | string | undefined>(undefined);
  readonly effectiveExpressionInput = computed(() => {
    return this.expression() ?? this.config()?.expression;
  });

  readonly gaze = input<boolean | 'pointer' | undefined>(undefined);
  readonly gazeTracking = input<boolean | 'pointer' | undefined>(undefined);
  readonly effectiveGaze = computed(() => {
    return this.gaze() ?? this.gazeTracking() ?? this.config()?.gaze ?? this.config()?.gazeTracking ?? false;
  });

  readonly bgColor = input<string | undefined>(undefined);
  readonly bg = input<string | undefined>(undefined);
  readonly backgroundColor = input<string | undefined>(undefined);
  readonly effectiveBgColor = computed(() => {
    return (
      this.bgColor() ??
      this.bg() ??
      this.backgroundColor() ??
      this.config()?.bgColor ??
      this.config()?.bg ??
      this.config()?.backgroundColor
    );
  });

  readonly background = input<'squircle' | 'circle' | 'square' | boolean | undefined>(undefined);
  readonly effectiveBackground = computed(() => {
    const explicit = this.background() ?? this.config()?.background;
    if (explicit !== undefined) return explicit;
    if (this.effectiveBgColor()) return 'squircle';
    return undefined;
  });

  readonly palette = input<{ head?: string; eye?: string; bg?: string } | undefined>(undefined);
  readonly effectivePalette = computed(() => {
    const base = this.palette() ?? this.config()?.palette;
    const customBg = this.effectiveBgColor();
    if (!customBg) return base;
    return { ...base, bg: customBg };
  });

  readonly hue = input<number | undefined>(undefined);
  readonly effectiveHue = computed(() => this.hue() ?? this.config()?.hue);

  readonly tone = input<number | undefined>(undefined);
  readonly effectiveTone = computed(() => this.tone() ?? this.config()?.tone);

  readonly traits = input<Record<string, any> | undefined>(undefined);
  readonly effectiveTraits = computed(() => this.traits() ?? this.config()?.traits);

  readonly drops = input<boolean | undefined>(undefined);
  readonly effectiveDrops = computed(() => this.drops() ?? this.config()?.drops ?? false);

  readonly normalize = input<boolean | undefined>(undefined);
  readonly contrast = input<number | undefined>(undefined);
  readonly title = input<string | undefined>(undefined);
  readonly alt = input<string | undefined>(undefined);

  readonly isAnimated = computed(() => {
    return (
      Boolean(this.effectiveAnimate()) ||
      Boolean(this.effectiveGaze()) ||
      Boolean(this.effectiveExpressionInput()) ||
      Boolean(this.effectiveDrops()) ||
      Boolean(this.effectivePalette()) ||
      this.effectiveBackground() !== undefined ||
      this.effectiveHue() !== undefined ||
      this.effectiveTone() !== undefined ||
      Boolean(this.effectiveTraits())
    );
  });

  readonly resolvedExpression = computed<Expression | undefined>(() => {
    const expr = this.effectiveExpressionInput();
    if (!expr) return undefined;
    return typeof expr === 'string' ? BLOBATAR_EXPRESSIONS[expr] : expr;
  });

  readonly blobatarOptions = computed<Record<string, any>>(() => {
    const opts: Record<string, any> = {
      size: this.effectiveSize(),
      title: this.title(),
      expression: this.resolvedExpression(),
    };
    if (this.effectiveBackground() !== undefined) opts['background'] = this.effectiveBackground();
    if (this.effectivePalette() !== undefined) opts['palette'] = this.effectivePalette();
    if (this.effectiveHue() !== undefined) opts['hue'] = this.effectiveHue();
    if (this.tone() !== undefined) opts['tone'] = this.effectiveTone();
    if (this.effectiveTraits() !== undefined) opts['traits'] = this.effectiveTraits();
    if (this.normalize() !== undefined) opts['normalize'] = this.normalize();
    if (this.contrast() !== undefined) opts['contrast'] = this.contrast();
    return opts;
  });

  readonly staticUri = computed(() => {
    if (this.isAnimated()) return '';
    return blobatarUri(this.effectiveSeed(), this.blobatarOptions());
  });

  readonly parts: Signal<BlobatarParts | null> = computed(() => {
    if (!this.isAnimated()) return null;
    const anim = this.effectiveAnimate();
    const animateMode: Animate = anim === 'hover' ? 'hover' : 'always';
    return _parts(this.effectiveSeed(), {
      ...this.blobatarOptions(),
      animate: animateMode,
    }) as BlobatarParts;
  });

  readonly sanitizedInner = computed<SafeHtml>(() => {
    const p = this.parts();
    return p ? this.sanitizer.bypassSecurityTrustHtml(p.inner) : '';
  });

  readonly svgStyle = computed(() => {
    const p = this.parts();
    return p?.vars ? serializeVars(p.vars) : null;
  });

  readonly svgClassesString = computed(() => {
    const bg = this.effectiveBackground();
    const anim = this.effectiveAnimate();
    const classes: string[] = [];
    if (bg === 'square') classes.push('blobatar-square');
    if (bg === 'squircle') classes.push('blobatar-squircle');
    if (bg === 'circle') classes.push('blobatar-circle');
    if (bg === false) classes.push('blobatar-transparent');
    if (anim === 'hover' || anim === true || anim === 'always') classes.push('blobatar-animated');
    if (this.effectiveGaze()) classes.push('blobatar-gaze');
    return classes.join(' ');
  });

  readonly svgClasses = computed(() => {
    const bg = this.effectiveBackground();
    const anim = this.effectiveAnimate();
    return {
      'blobatar-square': bg === 'square',
      'blobatar-squircle': bg === 'squircle',
      'blobatar-circle': bg === 'circle',
      'blobatar-transparent': bg === false,
      'blobatar-animated': anim === 'hover' || anim === true || anim === 'always',
      'blobatar-gaze': Boolean(this.effectiveGaze()),
    };
  });

  readonly serverHtml = computed<SafeHtml>(() => {
    if (this.isBrowser) return '';
    const sz = this.effectiveSize();
    const titleVal = this.title();
    const titleTag = titleVal ? `<title>${titleVal}</title>` : '';
    const classes = this.svgClassesString();

    if (!this.isAnimated()) {
      const uri = this.staticUri();
      const altVal = this.alt() || titleVal || '';
      return this.sanitizer.bypassSecurityTrustHtml(
        `<img src="${uri}" width="${sz}" height="${sz}" alt="${altVal}" class="${classes}" style="display:block;flex-shrink:0;border-radius:var(--blobatar-radius,50%)" />`
      );
    }

    const p = this.parts();
    if (!p) return '';
    const bgTag = p.bg ? `<path d="${p.bg.d}" fill="${p.bg.fill}" />` : '';
    const dropsTag = this.effectiveDrops()
      ? `<g class="canvas-paint-drops" opacity="0.95">
           <circle cx="18" cy="22" r="3.6" fill="#ec4899" />
           <path d="M18 16 C18 16 20.6 19.5 20.6 22 A2.6 2.6 0 0 1 15.4 22 C15.4 19.5 18 16 18 16 Z" fill="#ec4899" />
           <circle cx="82" cy="24" r="3.2" fill="#0ea5e9" />
           <path d="M82 19 C82 19 84.4 22 84.4 24 A2.4 2.4 0 0 1 79.6 24 C79.6 22 82 19 82 19 Z" fill="#0ea5e9" />
           <circle cx="17" cy="78" r="2.8" fill="#f59e0b" />
           <circle cx="23" cy="83" r="1.5" fill="#f59e0b" />
           <circle cx="83" cy="76" r="3.5" fill="#10b981" />
           <path d="M83 70 C83 70 86 73.5 86 76 A3 3 0 0 1 80 76 C80 73.5 83 70 83 70 Z" fill="#10b981" />
         </g>`
      : '';
    const styleAttr = this.svgStyle() ? `style="${this.svgStyle()}"` : '';
    const rawSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${sz}" height="${sz}" ${titleVal ? 'role="img"' : 'aria-hidden="true"'} class="${classes}" ${styleAttr}>${titleTag}${bgTag}${dropsTag}<g class="${p.cls || ''}">${p.inner}</g></svg>`;
    return this.sanitizer.bypassSecurityTrustHtml(rawSvg);
  });

  constructor() {
    effect(() => {
      const gazeEnabled = Boolean(this.effectiveGaze());
      const svgEl = this.svgElementRef()?.nativeElement;

      if (!this.isBrowser) return;

      if (this.gazeDriver) {
        this.gazeDriver.stop();
        this.gazeDriver = undefined;
      }

      if (gazeEnabled && svgEl && typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
        this.gazeDriver = initGaze(svgEl, { target: 'pointer' });
      }
    });
  }

  ngOnDestroy(): void {
    if (this.gazeDriver) {
      this.gazeDriver.stop();
      this.gazeDriver = undefined;
    }
  }
}
