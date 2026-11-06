import { describe, expect, it } from 'vitest';
import { buildPanel } from '../core/engine';
import { DEFAULT_DESIGN } from '../core/design';
import { FILLS, medallion } from '../core/patterns/medallion';
import { PATTERNS } from '../core/patterns/library';

describe('madalyon', () => {
  const ids = PATTERNS.filter((p) => p.id.startsWith('mad-')).map((p) => p.id);

  it('sekiz dış biçim, her biri bütün dolgularla düşen parçasız', () => {
    expect(ids).toHaveLength(8);
    for (const id of ids) {
      for (let f = 1; f <= FILLS.length; f++) {
        for (const density of [1.5, 3]) {
          const r = buildPanel({ ...DEFAULT_DESIGN, width: 500, height: 500, frameSide: 15, frameTopBottom: 15, cols: 1, rows: 1, squareTiles: false, patternId: id, params: { [id]: f, [`${id}#2`]: density }, bar: 5, minGap: 3 });
          expect({ id, f, density, islands: r.stats.islandCount, holes: r.stats.holeCount > 4 }).toEqual({ id, f, density, islands: 0, holes: true });
        }
      }
    }
  }, 120000);

  it('dolgu biçimin içinde kalır, dört kol karo kenarına uzanır', () => {
    const outline = Array.from({ length: 64 }, (_, i): [number, number] => [0.5 + 0.4 * Math.cos((i * Math.PI) / 32), 0.5 + 0.4 * Math.sin((i * Math.PI) / 32)]);
    const shapes = medallion(outline, 1, 2);
    const lines = shapes.filter((s) => s.t === 'line' && !s.closed);
    // Kollar dışında bütün çizgiler dairenin içinde
    const arms = lines.filter((s) => s.t === 'line' && s.pts.some(([x, y]) => x < 0.05 || x > 0.95 || y < 0.05 || y > 0.95));
    expect(arms).toHaveLength(4);
    for (const s of lines) {
      if (arms.includes(s) || s.t !== 'line') continue;
      for (const [x, y] of s.pts) expect(Math.hypot(x - 0.5, y - 0.5)).toBeLessThan(0.4 + 1e-3);
    }
  });

  it('dolgu adları ayarda görünür', () => {
    const p = PATTERNS.find((x) => x.id === 'mad-daire')!;
    expect(p.param?.names).toHaveLength(FILLS.length);
  });
});

describe('bulut kıvrımı', () => {
  it('her sıklık ve çeşitte tek parça (karo arası 0 ve karolu)', () => {
    for (const n of [1, 2, 3, 5, 8]) {
      for (const seed of [1, 42]) {
        for (const divider of [0, 8]) {
          const r = buildPanel({ ...DEFAULT_DESIGN, width: 400, height: 900, cols: 1, divider, bar: Math.max(3, 30 / n), minGap: 2, patternId: 'bulut-kivrim', params: { 'bulut-kivrim': n, 'bulut-kivrim#2': seed } });
          expect({ n, seed, divider, islands: r.stats.islandCount }).toEqual({ n, seed, divider, islands: 0 });
        }
      }
    }
  }, 120000);

  it('çeşit numarası deseni değiştirir, aynı numara aynı deseni verir', async () => {
    const { bulutKivrim } = await import('../core/patterns/styles');
    expect(JSON.stringify(bulutKivrim(3, 5))).toBe(JSON.stringify(bulutKivrim(3, 5)));
    expect(JSON.stringify(bulutKivrim(3, 5))).not.toBe(JSON.stringify(bulutKivrim(3, 6)));
  });
});

describe('on kollu gül', () => {
  it('açı ve kol aralığının bütün aralığında tek parça', () => {
    for (let a = 20; a <= 80; a += 5) {
      for (const dl of [0, 0.3, 0.6]) {
        const r = buildPanel({ ...DEFAULT_DESIGN, width: 600, height: 600, cols: 1, rows: 1, squareTiles: false, patternId: 'gul-10', params: { 'gul-10': a, 'gul-10#2': dl }, bar: 6, minGap: 3 });
        expect({ a, dl, islands: r.stats.islandCount }).toEqual({ a, dl, islands: 0 });
      }
    }
  }, 60000);
});
