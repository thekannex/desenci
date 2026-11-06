import { describe, expect, it } from 'vitest';
import { TILINGS, hankin, madalyon, signedArea } from '../core/patterns/girih';
import type { TilingName } from '../core/patterns/girih';
import { intersect, pathArea, rectPath, toPath, union } from '../core/geometry/clip';
import { buildPanel } from '../core/engine';
import { DEFAULT_DESIGN } from '../core/design';

// Döşeme birimleri küçük (1–7); clipper hassasiyeti için büyütülür
const K = 100;
const big = (pts: [number, number][]) => toPath(pts.map(([x, y]) => [x * K, y * K]));

describe('döşemeler', () => {
  for (const name of Object.keys(TILINGS) as TilingName[]) {
    it(`${name}: tekrar birimini boşluksuz ve üst üste binmeden kaplar`, () => {
      const t = TILINGS[name]();
      const cell = [rectPath(0, 0, t.w * K, t.h * K)];
      const pieces = t.polys.map((p) => intersect([big(p)], cell));
      const sum = pieces.reduce((s, ps) => s + ps.reduce((a, p) => a + pathArea(p), 0), 0);
      const covered = union(pieces.flat()).reduce((a, p) => a + pathArea(p), 0);
      const area = t.w * t.h * K * K;
      expect(Math.abs(covered - area) / area).toBeLessThan(0.002);
      expect(Math.abs(sum - area) / area).toBeLessThan(0.002);
      // Hepsi dışbükey ve alanı olan çokgenler
      for (const p of t.polys) expect(Math.abs(signedArea(p))).toBeGreaterThan(1e-3);
    });
  }

  it('Arşimet döşemelerinde bütün kenarlar 1 birim', () => {
    for (const name of ['kare', 'altigen', 'ucgen', 'sekizgen', 'onikigen', 'gul', 'kagome', 'yildizHac', 'kivrikKare', 'uzunUcgen'] as TilingName[]) {
      for (const p of TILINGS[name]().polys) {
        for (let i = 0; i < p.length; i++) {
          const [a, b] = [p[i], p[(i + 1) % p.length]];
          expect({ name, len: Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) * 1000) / 1000 }).toEqual({ name, len: 1 });
        }
      }
    }
  });

  it('Kahire beşgenleri beş kenarlı', () => {
    expect(TILINGS.kahire().polys.every((p) => p.length === 5)).toBe(true);
    expect(TILINGS.rombil().polys.every((p) => p.length === 4)).toBe(true);
  });
});

describe('Hankin', () => {
  it('kol aralığı her kenara bir birleştirme parçası ekler', () => {
    const sq = TILINGS.kare().polys.slice(0, 1);
    expect(hankin(sq, 60, 0)).toHaveLength(4);
    expect(hankin(sq, 60, 0.3)).toHaveLength(8);
  });

  it('açı 0 iken çizgiler döşemenin kenarlarından geçer', () => {
    const [tri] = TILINGS.ucgen().polys;
    for (const pl of hankin([tri], 0)) {
      // Orta nokta → köşe → orta nokta
      expect(tri.some((v) => Math.hypot(v[0] - pl[1][0], v[1] - pl[1][1]) < 1e-9)).toBe(true);
    }
  });
});

describe('madalyon', () => {
  it('kol sayısı kadar kiriş ve ışın, halkalıda çember', () => {
    expect(madalyon(8, 3, false)).toHaveLength(16);
    expect(madalyon(12, 5, true)).toHaveLength(25);
    // Sivrilik kol sayısının yarısını geçmez
    expect(madalyon(5, 7, false)).toHaveLength(10);
  });

  it('her kol sayısında düşen parça yok', () => {
    for (let n = 5; n <= 16; n++) {
      for (const k of [1, 2, 3, 5, 7]) {
        const r = buildPanel({ ...DEFAULT_DESIGN, patternId: 'madalyon', params: { madalyon: n, 'madalyon#2': k }, cols: 3, minGap: 3 });
        expect({ n, k, islands: r.stats.islandCount }).toEqual({ n, k, islands: 0 });
      }
    }
  });
});

describe('kol aralığı', () => {
  it('her yıldız deseninde kol aralığı 0–0,6 arası düşen parça vermez', async () => {
    const { PATTERNS } = await import('../core/patterns/library');
    for (const p of PATTERNS.filter((x) => x.param2?.label === 'Kol aralığı')) {
      for (const dl of [0.15, 0.3, 0.45, 0.6]) {
        const r = buildPanel({ ...DEFAULT_DESIGN, width: 400, height: 400, frameSide: 10, frameTopBottom: 10, patternId: p.id, params: { [`${p.id}#2`]: dl }, divider: 0, cols: 2, bar: 4, minGap: 2 });
        expect({ id: p.id, dl, islands: r.stats.islandCount }).toEqual({ id: p.id, dl, islands: 0 });
      }
    }
  }, 120000);
});
