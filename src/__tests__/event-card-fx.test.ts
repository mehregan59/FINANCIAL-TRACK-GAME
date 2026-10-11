import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(__dirname, '../../js/fx.js'), 'utf8');

function setup() {
  vi.useFakeTimers();
  document.body.innerHTML = '<div id="bankCard"></div><div id="walletRows"><div data-idx="0"></div></div>';
  const bank = document.getElementById('bankCard');
  const row = document.querySelector('#walletRows [data-idx="0"]');
  if (!bank || !row) throw new Error('Missing transfer endpoints');
  bank.getBoundingClientRect = () => ({ left: 900, top: 200, width: 100, height: 100 } as DOMRect);
  row.getBoundingClientRect = () => ({ left: 100, top: 200, width: 100, height: 100 } as DOMRect);
  const animate = vi.fn((_frames: Keyframe[] | PropertyIndexedKeyframes | null, _options?: number | KeyframeAnimationOptions) => ({ onfinish: null }));
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  const original = Element.prototype.animate;
  Element.prototype.animate = animate as unknown as typeof Element.prototype.animate;
  const fx = new Function('APP_STATE', 'money', 'curSym', source + '\nreturn FX;')(
    { players: [{ id: 'anna' }] }, (n: number) => '$' + n, () => '$',
  );
  return { fx, animate, restore: () => { Element.prototype.animate = original; } };
}

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); document.body.innerHTML = ''; });

describe('Event Card money transfers', () => {
  it.each([
    ['payment', -1200, 150, 950],
    ['reward', 1200, 950, 150],
  ])('%s moves money in the correct direction', (_name, dm, from, to) => {
    const { fx, animate, restore } = setup();
    try {
      fx.card({ by: 'anna', done: true, ok: true, dm });
      expect(document.querySelectorAll('.fx-token.coin')).toHaveLength(6);
      const frames = animate.mock.calls[0]?.[0] as unknown as { transform: string }[];
      const start = frames?.[0], end = frames?.[2];
      if (!start || !end) throw new Error('Missing money animation keyframes');
      const startX = Number(start.transform.match(/translate\(([-\d.]+)px/)?.[1]);
      expect(startX).toBeGreaterThanOrEqual(from - 20);
      expect(startX).toBeLessThanOrEqual(from + 20);
      expect(end.transform).toContain(`translate(${to}px, 250px)`);
    } finally { restore(); }
  });
  it('does not animate unpaid penalties, zero cash, unaccepted cards or duplicate card trades', () => {
    const { fx, animate, restore } = setup();
    try {
      fx.card({ by: 'anna', done: true, ok: false, dm: -1200 });
      fx.card({ by: 'anna', done: true, ok: true, dm: 0 });
      fx.card({ by: 'anna', done: false, ok: true, dm: 1200 });
      fx.trade({ by: 'anna', card: true, kind: 'buy', qty: 3, price: 500 });
      expect(animate).not.toHaveBeenCalled();
    } finally { restore(); }
  });
});