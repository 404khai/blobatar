import { Component, NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BlobatarComponent, BLOBATAR_EXPRESSIONS, BlobatarCustomConfig } from './blobatar.component';

describe('BlobatarComponent', () => {
  let component: BlobatarComponent;
  let fixture: ComponentFixture<BlobatarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BlobatarComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(BlobatarComponent);
    component = fixture.componentInstance;
  });

  it('should create component instance', () => {
    expect(component).toBeTruthy();
  });

  it('should render static <img> element by default for performance', () => {
    fixture.componentRef.setInput('name', 'developer@example.com');
    fixture.componentRef.setInput('size', 48);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const img = host.querySelector('img');
    const svg = host.querySelector('svg');

    expect(img).toBeTruthy();
    expect(svg).toBeNull();
    expect(img?.getAttribute('src')).toMatch(/^data:image\/svg\+xml/);
    expect(img?.getAttribute('width')).toBe('48');
    expect(img?.getAttribute('height')).toBe('48');
  });

  it('should switch to inline <svg> when animate is true', () => {
    fixture.componentRef.setInput('name', 'animated-user');
    fixture.componentRef.setInput('animate', true);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const img = host.querySelector('img');
    const svg = host.querySelector('svg');

    expect(img).toBeNull();
    expect(svg).toBeTruthy();
    expect(svg?.querySelector('g')).toBeTruthy();
  });

  it('should switch to inline <svg> when expression is provided', () => {
    fixture.componentRef.setInput('name', 'expressive-user');
    fixture.componentRef.setInput('expression', 'happy');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const svg = host.querySelector('svg');

    expect(svg).toBeTruthy();
    const g = svg?.querySelector('g');
    expect(g).toBeTruthy();
  });

  it('should bind config preset object and allow expression override', () => {
    const preset: BlobatarCustomConfig = {
      seed: 'ori-scout',
      size: 80,
      palette: { head: '#534AB7', eye: '#1e194f', bg: '#f3f1fd' },
      background: 'squircle',
      expression: 'idle',
      animated: true,
      gazeTracking: true,
    };

    fixture.componentRef.setInput('config', preset);
    fixture.componentRef.setInput('expression', 'thinking');
    fixture.detectChanges();

    expect(component.effectiveSeed()).toBe('ori-scout');
    expect(component.effectiveSize()).toBe(80);
    expect(component.resolvedExpression()).toBe(BLOBATAR_EXPRESSIONS['thinking']);

    const host = fixture.nativeElement as HTMLElement;
    const svg = host.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('width')).toBe('80');
    expect(svg?.classList.contains('blobatar-squircle')).toBe(true);
  });

  it('should render custom paint drops when drops is true', () => {
    fixture.componentRef.setInput('name', 'artist');
    fixture.componentRef.setInput('drops', true);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const dropsEl = host.querySelector('.canvas-paint-drops');
    expect(dropsEl).toBeTruthy();
  });

  it('should support backward-compatible seed and animated input aliases', () => {
    fixture.componentRef.setInput('seed', 'legacy-seed-key');
    fixture.componentRef.setInput('animated', true);
    fixture.detectChanges();

    expect(component.effectiveSeed()).toBe('legacy-seed-key');
    expect(component.effectiveAnimate()).toBe(true);
  });

  it('should project custom content into svg via ng-content', () => {
    @Component({
      standalone: true,
      imports: [BlobatarComponent],
      schemas: [NO_ERRORS_SCHEMA],
      template: `
        <blobatar name="custom-projected" [animate]="true">
          <svg:circle class="custom-badge" cx="90" cy="90" r="10" fill="gold" />
        </blobatar>
      `,
    })
    class TestWrapperComponent {}

    const wrapFixture = TestBed.createComponent(TestWrapperComponent);
    wrapFixture.detectChanges();

    const badge = wrapFixture.nativeElement.querySelector('.custom-badge');
    expect(badge).toBeTruthy();
    expect(badge.getAttribute('fill')).toBe('gold');
  });

  it('should accept direct bgColor and auto-enable squircle backdrop', () => {
    fixture.componentRef.setInput('name', 'bg-test');
    fixture.componentRef.setInput('bgColor', '#f43f5e');
    fixture.componentRef.setInput('animate', true);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const svg = host.querySelector('svg');
    expect(svg?.classList.contains('blobatar-squircle')).toBe(true);

    const bgPath = svg?.querySelector('path');
    expect(bgPath?.getAttribute('fill')).toBe('#f43f5e');
  });

  it('should allow bg alias to override preset palette background', () => {
    const preset: BlobatarCustomConfig = {
      seed: 'preset-bg',
      palette: { bg: '#eef2ff' },
      background: 'circle',
      animated: true,
    };

    fixture.componentRef.setInput('config', preset);
    fixture.componentRef.setInput('bg', '#10b981');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const bgPath = host.querySelector('svg path');
    expect(bgPath?.getAttribute('fill')).toBe('#10b981');
  });
});
