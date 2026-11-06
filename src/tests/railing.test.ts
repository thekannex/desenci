import { describe, expect, it } from 'vitest';
import { buildPanel } from '../core/engine';
import { DEFAULT_DESIGN } from '../core/design';

describe('korkuluk ve pencere ferforjesi', () => {
  for (const id of ['kapsul', 'ferforje-pencere']) {
    it(`${id}: farklı panel ve çubuk sayılarında tek parça`, () => {
      for (const [w, h, cols] of [[1400, 900, 6], [1000, 1000, 4], [1200, 1300, 8], [600, 1800, 3]]) {
        for (const k of [0, 1]) {
          const r = buildPanel({ ...DEFAULT_DESIGN, width: w, height: h, cols, divider: 0, bar: 10, minGap: 3, patternId: id, params: id === 'kapsul' ? { kapsul: k } : { 'ferforje-pencere': 0.3 + k * 0.4 } });
          expect({ id, w, h, cols, k, islands: r.stats.islandCount }).toEqual({ id, w, h, cols, k, islands: 0 });
          expect(r.stats.holeCount).toBeGreaterThan(cols);
        }
      }
    });
  }

  it('karo uzayınca göbek dairesi gerçek ölçüde yuvarlak kalır', () => {
    for (const h of [700, 1400]) {
      const r = buildPanel({ ...DEFAULT_DESIGN, width: 1200, height: h, cols: 6, divider: 0, bar: 2, minGap: 0, patternId: 'kapsul', params: { kapsul: 0 } });
      // Göbeğin en içteki halkası (sekiz kolun ortasındaki küçük boşluk) en ve boyu eşit
      const t0 = r.layout.tiles[0];
      const c: [number, number] = [t0.x + t0.w / 2, t0.y + t0.h / 2];
      const mid = (pts: [number, number][]) => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
      const holes = r.contours.filter((x) => x.kind === 'hole');
      const small = holes.reduce((a, b) => {
        const [ax, ay] = mid(a.pts), [bx, by] = mid(b.pts);
        return Math.hypot(ax - c[0], ay - c[1]) < Math.hypot(bx - c[0], by - c[1]) ? a : b;
      });
      const xs = small.pts.map((p) => p[0]);
      const ys = small.pts.map((p) => p[1]);
      expect((Math.max(...xs) - Math.min(...xs)) / (Math.max(...ys) - Math.min(...ys))).toBeCloseTo(1, 1);
    }
  });

  it('tercih edilen oran: balkon ve pencere için tek sıra uzun karo', () => {
    expect(buildPanel({ ...DEFAULT_DESIGN, width: 1400, height: 900, cols: 6, patternId: 'kapsul' }).layout.rows).toBe(1);
    expect(buildPanel({ ...DEFAULT_DESIGN, width: 1200, height: 1300, cols: 8, patternId: 'ferforje-pencere' }).layout.rows).toBe(1);
  });
});
