import { describe, expect, it } from 'vitest';
import { DEFAULT_DESIGN, normalizeDesign } from '../core/design';
import type { Design } from '../core/design';
import { buildPanel, cleanHoles, mountPositions, tileHoles } from '../core/engine';
import { computeLayout, squareRows } from '../core/layout';
import { PATTERNS, getPattern, orient, patternParam } from '../core/patterns/library';
import { L } from '../core/patterns/shapes';
import { contourTree, difference, pathArea, rectPath, toPath, union } from '../core/geometry/clip';
import { mapShape } from '../core/patterns/shapes';

const design = (p: Partial<Design>): Design => ({ ...DEFAULT_DESIGN, minGap: 0, ...p });
const sumArea = (paths: ReturnType<typeof tileHoles>) => paths.reduce((s, p) => s + pathArea(p), 0);

describe('yerleşim', () => {
  it('karolar iç alanı karo aralarıyla birlikte tam doldurur', () => {
    const l = computeLayout(design({ width: 1000, height: 900, frameSide: 30, frameTopBottom: 40, divider: 10, cols: 5, rows: 3, squareTiles: false }));
    expect(l.tiles).toHaveLength(15);
    expect(l.tileW * 5 + 4 * 10).toBeCloseTo(940);
    expect(l.tileH * 3 + 2 * 10).toBeCloseTo(820);
    const last = l.tiles[l.tiles.length - 1];
    expect(last.x + last.w).toBeCloseTo(970);
    expect(last.y + last.h).toBeCloseTo(860);
  });

  it('kare karoda sıra sayısı kareye en yakın olanı seçer', () => {
    expect(squareRows(940, 840, 5, 10)).toBe(4); // karo eni 180 → 840 / 190 ≈ 4,4
    const l = computeLayout(design({ width: 1000, height: 900, cols: 5, squareTiles: true }));
    expect(l.rows).toBe(4);
    expect(Math.abs(l.tileW - l.tileH)).toBeLessThan(l.tileW * 0.25);
  });

  it('sığmayan yerleşimde hata verir', () => {
    expect(computeLayout(design({ width: 100, frameSide: 60 })).error).toBeTruthy();
    expect(computeLayout(design({ width: 100, cols: 40, squareTiles: false })).error).toBeTruthy();
  });
});

describe('karo boşlukları', () => {
  it('artı deseni dört eşit kare boşluk bırakır', () => {
    const holes = tileHoles(getPattern('arti').build(0, 0, 1), 'bar', 160, 160, 10);
    expect(holes).toHaveLength(4);
    for (const h of holes) expect(pathArea(h)).toBeCloseTo(75 * 75, 0);
  });

  it('yarık deseninde boşluk yarıkların kendisidir (uçları yuvarlak)', () => {
    const holes = tileHoles([L([0.25, 0.5], [0.75, 0.5])], 'slot', 200, 200, 10);
    expect(holes).toHaveLength(1);
    // 100 mm boy × 10 mm + iki yarım daire
    expect(sumArea(holes)).toBeCloseTo(100 * 10 + Math.PI * 25, -1);
  });

  it('köşe yarıçapı her köşeden (4 − π)·r² alan alır', () => {
    const sq = [rectPath(0, 0, 100, 100)];
    expect(sumArea(cleanHoles(sq, 0, 10))).toBeCloseTo(10000 - (4 - Math.PI) * 100, -1);
  });

  it('boşluğa giren sivri metal köşe de yuvarlanır (L biçimli boşluk)', () => {
    // 100 × 100 kareden 50 × 50 çıkmış L: 5 dış köşe her biri k kaybeder, 1 iç köşe k kazanır
    const L6 = [toPath([[0, 0], [100, 0], [100, 50], [50, 50], [50, 100], [0, 100]])];
    const r = 8;
    const k = (1 - Math.PI / 4) * r * r;
    expect(sumArea(cleanHoles(L6, 0, r))).toBeCloseTo(7500 - 5 * k + k, -1);
    // Yarıçap sınırı 0 ise iç köşe sivri kalır
    expect(sumArea(cleanHoles(L6, 0, r, 0))).toBeCloseTo(7500 - 5 * k, -1);
  });

  it('iç köşe yuvarlatması ince metali eritip boşlukları birleştirmez', () => {
    // 2 mm metalle ayrılmış iki kare boşluk, 6 mm yarıçap
    const two = [rectPath(0, 0, 50, 50), rectPath(52, 0, 50, 50)];
    const out = cleanHoles(two, 0, 6);
    expect(out.filter((p) => pathArea(p) > 1)).toHaveLength(2);
  });

  it('en dar boşluk ayarı dar yarıkları siler, genişleri bozmaz', () => {
    const thin = [rectPath(0, 0, 100, 3)];
    const wide = [rectPath(0, 0, 100, 20)];
    expect(cleanHoles(thin, 4, 0)).toHaveLength(0);
    expect(sumArea(cleanHoles(wide, 4, 0))).toBeCloseTo(2000, 0);
  });
});

describe('panel', () => {
  it('tek karolu artı panelinin konturları ve ölçüleri doğru', () => {
    const r = buildPanel(design({ width: 200, height: 200, frameSide: 20, frameTopBottom: 20, cols: 1, rows: 1, squareTiles: false, patternId: 'arti', bar: 10, thickness: 2 }));
    expect(r.stats.holeCount).toBe(4);
    expect(r.contours[r.contours.length - 1].kind).toBe('outer');
    expect(r.stats.openArea).toBeCloseTo(4 * 75 * 75, -1);
    expect(r.stats.cutLength).toBeCloseTo(4 * 300 + 800, 0);
    expect(r.stats.pierces).toBe(5);
    expect(r.stats.weight).toBeCloseTo((40000 - 22500) * 2 * 7.85e-6, 3);
    expect(r.warnings.filter((w) => w.level !== 'info')).toHaveLength(0);
  });

  it('karo arası sıfırken komşu boşluklar birleşir', () => {
    const base = { width: 420, height: 220, frameSide: 10, frameTopBottom: 10, cols: 2, rows: 1, squareTiles: false, patternId: 'cizgili', params: { cizgili: 1 } };
    // Tek yatay çubuk: her karoda üst ve alt boşluk; aralık yokken iki karonunkiler birleşir
    expect(buildPanel(design({ ...base, divider: 10 })).stats.holeCount).toBe(4);
    expect(buildPanel(design({ ...base, divider: 0 })).stats.holeCount).toBe(2);
  });

  it('karo aralı hızlı yol ile birleşik yol aynı boşluk alanını verir', () => {
    // Aralık çok inceyken (0,01 mm) ve sıfırken boşluk alanı neredeyse aynı olmalı
    const base = design({ patternId: 'kafes', divider: 0.01, cols: 4, squareTiles: true });
    const a = buildPanel(base).stats.openArea;
    const b = buildPanel({ ...base, divider: 0 }).stats.openArea;
    expect(Math.abs(a - b) / b).toBeLessThan(0.01);
  });

  it('boşluğun içinde kalan metali düşen parça (2. derinlik) sayar', () => {
    // 100 mm kare boşluğun ortasında 40 mm kare metal: boşluk konturu + içinde düşen parça
    const holes = difference([rectPath(0, 0, 100, 100)], [rectPath(30, 30, 40, 40)]);
    const tree = contourTree(holes);
    expect(tree.map((n) => n.depth).sort()).toEqual([1, 2]);
    // Kırıntı eşiği iç konturu atar
    expect(contourTree(holes, 2000)).toHaveLength(1);
  });

  it('karo arası 0 iken karo karo düzeltme, bütünü birden düzeltmeyle aynı sonucu verir', () => {
    for (const patternId of ['gecme-halka', 'dalga', 'kafes']) {
      const d = design({ patternId, width: 700, height: 500, cols: 4, divider: 0, minGap: 6, cornerRadius: 3, mirrorX: true });
      const r = buildPanel(d);
      const l = computeLayout(d);
      const p = getPattern(patternId);
      const all = l.tiles.flatMap((t) => {
        const mx = t.col % 2 === 1;
        const shapes = p.build(patternParam(p, {}), patternParam(p, {}, 2), 1).map((s) => mapShape(s, (q) => orient(q, 0, mx, false)));
        return tileHoles(shapes, p.kind, l.tileW, l.tileH, d.bar).map((path) => path.map((q) => ({ X: q.X + Math.round(t.x * 100), Y: q.Y + Math.round(t.y * 100) })));
      });
      const global = contourTree(cleanHoles(union(all), d.minGap, d.cornerRadius), 1);
      expect(r.stats.holeCount).toBe(global.filter((n) => n.depth === 1).length);
      const area = global.reduce((s, n) => s + (n.depth % 2 ? 1 : -1) * pathArea(n.path), 0);
      const mine = r.contours.reduce((s, c) => s + (c.kind === 'hole' ? c.area : c.kind === 'island' ? -c.area : 0), 0);
      expect(Math.abs(mine - area) / area).toBeLessThan(0.001);
    }
  });

  it('döndürme ve aynalama boşluk alanını değiştirmez', () => {
    const base = design({ patternId: 'sarmal', width: 640, height: 640, cols: 3, rows: 3, squareTiles: false });
    const a = buildPanel(base).stats.openArea;
    for (const p of [{ rotate: 90 as const }, { rotate: 270 as const }, { mirrorX: true }, { mirrorY: true, mirrorX: true }]) {
      expect(buildPanel({ ...base, ...p }).stats.openArea).toBeCloseTo(a, -2);
    }
  });

  it('ince çubukta ve sığmayan yerleşimde uyarır', () => {
    expect(buildPanel(design({ bar: 2, thickness: 3 })).warnings.some((w) => w.text.includes('sac kalınlığından'))).toBe(true);
    const bad = buildPanel(design({ width: 100, frameSide: 60 }));
    expect(bad.warnings[0].level).toBe('error');
    expect(bad.contours).toHaveLength(1);
  });

  it('en dar boşluk ayarı küçük boşlukları sayar', () => {
    const r = buildPanel(design({ patternId: 'izgara', params: { izgara: 8 }, cols: 6, bar: 10, minGap: 15 }));
    expect(r.stats.droppedHoles).toBeGreaterThan(0);
    expect(r.warnings.some((w) => w.text.includes('kesilmedi'))).toBe(true);
  });
});

describe('desen kütüphanesi', () => {
  it('kimlikler benzersiz, ayarlar sınır içinde', () => {
    expect(new Set(PATTERNS.map((p) => p.id)).size).toBe(PATTERNS.length);
    for (const p of PATTERNS) if (p.param) expect(p.param.def).toBeGreaterThanOrEqual(p.param.min);
    expect(patternParam(getPattern('izgara'), { izgara: 99 })).toBe(8);
    expect(patternParam(getPattern('izgara'), {})).toBe(3);
    expect(getPattern('yok').id).toBe(PATTERNS[0].id);
  });

  // Her desen varsayılan ayarlarla kesilebilir olmalı: boşluk var, düşen parça yok
  for (const p of PATTERNS) {
    it(`${p.name}: boşluk bırakır, düşen parça yok`, () => {
      const r = buildPanel(design({ patternId: p.id, minGap: 4 }));
      expect(r.stats.holeCount).toBeGreaterThan(0);
      expect(r.stats.islandCount).toBe(0);
      expect(r.stats.openRatio).toBeGreaterThan(0.05);
      expect(r.stats.openRatio).toBeLessThan(0.95);
    });
  }
});

describe('bağlantı delikleri', () => {
  it('köşelere ve aralıklara yerleşir, çerçeve dışına taşmaz', () => {
    const d = design({ width: 1000, height: 900, frameSide: 30, frameTopBottom: 30, mountHoles: true, mountDiameter: 10, mountSpacing: 400 });
    const { pts } = mountPositions(d);
    // Üst / alt: 940 / 400 → 3 aralık, 4 delik; yan: 840 / 400 → 3 aralık, uçlar hariç 2 delik
    expect(pts).toHaveLength(2 * 4 + 2 * 2);
    for (const [x, y] of pts) {
      const inFrame = x <= 30 || x >= 970 || y <= 30 || y >= 870;
      expect(inFrame).toBe(true);
    }
    expect(buildPanel(d).stats.mountCount).toBe(12);
  });

  it('dar çerçevede uyarır', () => {
    const r = buildPanel(design({ frameSide: 8, frameTopBottom: 8, mountHoles: true, mountDiameter: 10 }));
    expect(r.stats.mountCount).toBe(0);
    expect(r.warnings.some((w) => w.text.includes('Bağlantı'))).toBe(true);
  });
});

describe('tasarım verisi', () => {
  it('bozuk veriyi tamamlar ve sınırlar', () => {
    const d = normalizeDesign({ width: -5, cols: 2.6, patternId: 'yok', rotate: 45, params: { a: 'x', b: 2 } });
    expect(d.width).toBe(20);
    expect(d.cols).toBe(3);
    expect(d.patternId).toBe(DEFAULT_DESIGN.patternId);
    expect(d.rotate).toBe(0);
    expect(d.params).toEqual({ b: 2 });
    expect(normalizeDesign(null)).toEqual(DEFAULT_DESIGN);
  });
});

describe('kesintisiz ve yıldız desenleri', () => {
  for (const p of PATTERNS.filter((x) => x.seamless)) {
    it(`${p.name}: karo arası 0 iken de kesilebilir`, () => {
      const r = buildPanel(design({ patternId: p.id, divider: 0, minGap: 4, cols: 3 }));
      expect(r.stats.holeCount).toBeGreaterThan(0);
      expect(r.stats.islandCount).toBe(0);
    });
  }

  it('yıldız açısının bütün aralığında düşen parça çıkmaz', () => {
    const girih = PATTERNS.filter((p) => p.id.startsWith('girih-') && p.param?.unit === '°');
    expect(girih.length).toBeGreaterThan(8);
    for (const p of girih) {
      for (let a = 0; a <= 85; a += 5) {
        const r = buildPanel(design({ width: 400, height: 400, frameSide: 10, frameTopBottom: 10, patternId: p.id, params: { [p.id]: a }, divider: 0, cols: 2, bar: 4, minGap: 2 }));
        expect({ id: p.id, a, islands: r.stats.islandCount }).toEqual({ id: p.id, a, islands: 0 });
      }
    }
  }, 120000);

  it('desen oranı karo boyutunu belirler (altıgen düzen)', () => {
    const r = buildPanel(design({ patternId: 'petek', width: 1000, height: 1000, frameSide: 0, frameTopBottom: 0, divider: 0, cols: 2 }));
    // Petek birimi √3 × 3: eni / boyu 0,577
    // Sıra sayısı tam sayı olduğundan en yakın ulaşılabilir oran (2 sütun → 1 sıra: 0,5)
    expect(Math.abs(r.layout.tileW / r.layout.tileH - 1 / Math.sqrt(3))).toBeLessThan(0.1);
    const rot = buildPanel(design({ patternId: 'petek', width: 1000, height: 1000, frameSide: 0, frameTopBottom: 0, divider: 0, cols: 2, rotate: 90 }));
    expect(rot.layout.tileW / rot.layout.tileH).toBeGreaterThan(1.3);
  });

  it('iki ayarlı desen ikinci ayarı kullanır', () => {
    const a = buildPanel(design({ patternId: 'voronoi', params: { voronoi: 4, 'voronoi#2': 1 } }));
    const b = buildPanel(design({ patternId: 'voronoi', params: { voronoi: 4, 'voronoi#2': 2 } }));
    expect(a.stats.openArea).not.toBeCloseTo(b.stats.openArea, 0);
  });
});

describe('köşe yuvarlatma bütün desenlerde', () => {
  it('sivri uç yuvarlatması hiçbir desende boşluk birleştirmez', () => {
    for (const p of PATTERNS) {
      const shapes = p.build(patternParam(p, {}), patternParam(p, {}, 2), 1);
      const raw = tileHoles(shapes, p.kind, 200, 200, p.kind === 'bar' ? 8 : 8);
      const count = (paths: ReturnType<typeof tileHoles>) => contourTree(paths, 1).filter((n) => n.depth === 1).length;
      const without = count(cleanHoles(raw, 3, 4, 0));
      const withInner = count(cleanHoles(raw, 3, 4, p.kind === 'bar' ? 3.6 : 4));
      expect({ id: p.id, holes: withInner }).toEqual({ id: p.id, holes: without });
    }
  }, 60000);
});
