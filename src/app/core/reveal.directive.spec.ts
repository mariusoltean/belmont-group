import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RevealDirective } from './reveal.directive';

@Component({
  imports: [RevealDirective],
  template: `<div appReveal>content</div>`,
})
class Host {}

class FakeObserver {
  static last?: FakeObserver;
  disconnect = vi.fn();
  observe = vi.fn();
  constructor(public callback: IntersectionObserverCallback) {
    FakeObserver.last = this;
  }
  fire(isIntersecting: boolean) {
    this.callback([{ isIntersecting } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}

function mockTop(top: number) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ top } as DOMRect);
}

function mockReducedMotion(matches: boolean) {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches }));
}

async function render() {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  return fixture.nativeElement.querySelector('div') as HTMLElement;
}

describe('RevealDirective', () => {
  beforeEach(() => {
    FakeObserver.last = undefined;
    Object.defineProperty(window, 'innerHeight', { value: 1000, configurable: true });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('hides content below the fold, then reveals it once and disconnects', async () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    mockReducedMotion(false);
    mockTop(1200);
    const el = await render();

    expect(el.style.opacity).toBe('0');
    expect(el.style.transform).toBe('translateY(28px)');
    expect(el.style.transition).toContain('opacity 0.8s ease');

    FakeObserver.last!.fire(true);
    expect(el.style.opacity).toBe('1');
    expect(el.style.transform).toBe('translateY(0px)');
    expect(FakeObserver.last!.disconnect).toHaveBeenCalled();
  });

  it('leaves content that is already in view untouched', async () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    mockReducedMotion(false);
    mockTop(400);
    const el = await render();
    expect(el.style.opacity).toBe('');
    expect(FakeObserver.last).toBeUndefined();
  });

  it('does nothing when reduced motion is requested', async () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    mockReducedMotion(true);
    mockTop(1200);
    const el = await render();
    expect(el.style.opacity).toBe('');
  });

  it('does nothing without IntersectionObserver', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    mockReducedMotion(false);
    mockTop(1200);
    const el = await render();
    expect(el.style.opacity).toBe('');
  });
});
