import { Component, signal } from '@angular/core';
import { Blobatar } from '@blobatar/angular';
import { BlobatarGaze } from '@blobatar/angular/gaze';
import {
  happy, idle, love, mad, sad, scared, shy, sick, sleepy, smug, surprised, thinking, unsure, wink,
} from 'blobatar/expression';
import type { Animate, Expression } from '@blobatar/angular';

@Component({
  selector: 'app-root',
  imports: [Blobatar, BlobatarGaze],
  template: `
    <main>
      <h1>&#64;blobatar/angular</h1>
      <p class="sub">Example app. The package is installed from the packed tarballs, so this is what a consumer gets.</p>

      <section>
        <h2>1. Static (renders &lt;img&gt;)</h2>
        <div class="row">
          @for (n of names; track n) {
            <figure>
              <blobatar [name]="n" [size]="64" />
              <figcaption>{{ n }}</figcaption>
            </figure>
          }
        </div>
      </section>

      <section>
        <h2>2. Options</h2>
        <div class="row">
          <figure><blobatar name="alain" [size]="64" background="circle" /><figcaption>circle</figcaption></figure>
          <figure><blobatar name="alain" [size]="64" background="squircle" /><figcaption>squircle</figcaption></figure>
          <figure><blobatar name="alain" [size]="64" [hue]="210" /><figcaption>hue 210</figcaption></figure>
          <figure><blobatar name="alain" [size]="64" [tone]="0.2" /><figcaption>tone 0.2</figcaption></figure>
          <figure><blobatar name="alain" [size]="64" title="Alain <script>" /><figcaption>title (escaped)</figcaption></figure>
        </div>
      </section>

      <section>
        <h2>3. Animated (renders inline &lt;svg&gt;)</h2>
        <div class="row">
          <figure><blobatar name="ori" [size]="96" animate="always" /><figcaption>always</figcaption></figure>
          <figure><blobatar name="ori" [size]="96" animate="hover" /><figcaption>hover me</figcaption></figure>
          <figure>
            <blobatar name="toggle-me" [size]="96" [animate]="toggled() ? 'always' : false" />
            <figcaption><button (click)="toggled.set(!toggled())">animate: {{ toggled() ? 'always' : 'false' }}</button></figcaption>
          </figure>
        </div>
      </section>

      <section>
        <h2>4. Expressions (should morph, not jump)</h2>
        <div class="row">
          <blobatar name="moody" [size]="128" animate="always" background="squircle" [expression]="expression()" />
        </div>
        <div class="buttons">
          @for (e of expressions; track e[0]) {
            <button [class.on]="expression() === e[1]" (click)="expression.set(e[1])">{{ e[0] }}</button>
          }
        </div>
      </section>

      <section>
        <h2>5. Gaze (eyes follow the pointer)</h2>
        <div class="row">
          <blobatar name="watcher" [size]="160" animate="always" gaze="pointer" [gazeTravel]="3" />
          <blobatar name="focus-follower" [size]="160" animate="always" gaze [gazeTravel]="3" #g="blobatarGaze" />
        </div>
        <p class="sub">The second one looks at whichever input has focus:</p>
        <div class="buttons">
          <input placeholder="left" (focus)="g.lookAt($any($event.target))" (blur)="g.lookAt('rest')" />
          <input placeholder="right" (focus)="g.lookAt($any($event.target))" (blur)="g.lookAt('rest')" />
        </div>
      </section>

      <section>
        <h2>6. Live name</h2>
        <input [value]="live()" (input)="live.set($any($event.target).value)" />
        <div class="row">
          <blobatar [name]="live()" [size]="96" />
          <blobatar [name]="live()" [size]="96" [animate]="animateMode()" />
        </div>
      </section>
    </main>
  `,
  styles: [`
    main { font-family: system-ui, sans-serif; max-width: 900px; margin: 0 auto; padding: 24px 16px; color: #222; }
    h1 { margin-bottom: 4px; }
    .sub { color: #666; margin-top: 0; }
    section { margin: 32px 0; }
    h2 { font-size: 16px; }
    .row { display: flex; flex-wrap: wrap; gap: 20px; align-items: center; }
    figure { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 6px; }
    figcaption { font-size: 12px; color: #555; }
    .buttons { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
    button { padding: 4px 10px; border: 1px solid #ccc; background: #fff; border-radius: 6px; cursor: pointer; }
    button.on { background: #222; color: #fff; }
    input { padding: 6px 8px; border: 1px solid #ccc; border-radius: 6px; }
  `],
})
export class AppComponent {
  names = ['alain', 'andre', 'ada@example.com', 'grace', 'linus', 'margaret'];
  toggled = signal(true);
  live = signal('type a name');
  animateMode = signal<Animate>('always');

  expressions: [string, Expression][] = Object.entries({
    idle, happy, sad, mad, surprised, wink, sleepy, smug, unsure, scared, love, shy, sick, thinking,
  });
  expression = signal<Expression>(idle);
}
