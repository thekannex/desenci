import { describe, expect, it } from 'vitest';
import { readDxf } from '../core/import/dxf';
import { readSvg, parsePathData, parseTransform } from '../core/import/svg';
import { bulgePts, chainPaths, toPattern } from '../core/import/geometry';
import { applySymmetry, customToDef, sanitizeCustom } from '../core/patterns/custom';
import type { CustomPattern } from '../core/patterns/custom';
import { buildPanel } from '../core/engine';
import { DEFAULT_DESIGN, normalizeDesign } from '../core/design';
import type { Pt } from '../core/patterns/shapes';

const bbox = (pts: Pt[]) => ({
  minX: Math.min(...pts.map((p) => p[0])), maxX: Math.max(...pts.map((p) => p[0])),
  minY: Math.min(...pts.map((p) => p[1])), maxY: Math.max(...pts.map((p) => p[1])),
});

/** Basit DXF yazıcı (testler için). */
const dxf = (...entities: string[][]) => ['0', 'SECTION', '2', 'ENTITIES', ...entities.flat(), '0', 'ENDSEC', '0', 'EOF'].join('\n');
const line = (x1: number, y1: number, x2: number, y2: number) => ['0', 'LINE', '8', '0', '10', `${x1}`, '20', `${y1}`, '11', `${x2}`, '21', `${y2}`];

describe('SVG okuma', () => {
  it('dikdörtgen, daire ve çizgi; dönüşümler uygulanır', () => {
    const r = readSvg(`<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <!-- yorum -->
      <defs><rect x="0" y="0" width="5" height="5"/></defs>
      <g transform="translate(10 20)"><rect x="0" y="0" width="30" height="10"/></g>
      <circle cx="50" cy="50" r="10" transform="scale(2)"/>
      <line x1="0" y1="0" x2="10" y2="0" style="display:none"/>
      <polyline points="0,0 10,10 20,0"/>
    </svg>`);
    expect(r.paths).toHaveLength(3);
    const rect = bbox(r.paths[0].pts);
    expect(rect).toEqual({ minX: 10, maxX: 40, minY: 20, maxY: 30 });
    expect(r.paths[0].closed).toBe(true);
    const c = bbox(r.paths[1].pts);
    expect(c.minX).toBeCloseTo(80);
    expect(c.maxX).toBeCloseTo(120);
    expect(r.paths[2].closed).toBe(false);
  });

  it('path komutları: göreli, H / V, kapatma ve birden çok alt yol', () => {
    const p = parsePathData('M10 10 h20 v20 H10 z m40 0 l10 0 l0 10');
    expect(p).toHaveLength(2);
    expect(p[0].closed).toBe(true);
    expect(p[0].pts).toEqual([[10, 10], [30, 10], [30, 30], [10, 30]]);
    expect(p[1].pts).toEqual([[50, 10], [60, 10], [60, 20]]);
  });

  it('yay ve eğriler uç noktaya varır', () => {
    const [arc] = parsePathData('M0 0 A10 10 0 0 1 20 0');
    const end = arc.pts[arc.pts.length - 1];
    expect(end[0]).toBeCloseTo(20);
    expect(end[1]).toBeCloseTo(0);
    // Yarım daire: en uzak nokta merkezden 10 birim (y = -10 ya da 10)
    expect(Math.max(...arc.pts.map((q) => Math.abs(q[1])))).toBeCloseTo(10, 1);
    const [cur] = parsePathData('M0 0 C0 10 10 10 10 0 S20 -10 20 0');
    expect(cur.pts[cur.pts.length - 1]).toEqual([20, 0]);
  });

  it('dönüşüm dizisi soldan sağa uygulanır', () => {
    const m = parseTransform('translate(10,0) rotate(90)');
    // (1,0) önce 90° döner (0,1), sonra +10 x
    expect(m[0] * 1 + m[4]).toBeCloseTo(10);
    expect(m[1] * 1 + m[5]).toBeCloseTo(1);
  });
});

describe('DXF okuma', () => {
  it('tek tek çizgilerden kapalı kontur kurulur, y ekseni çevrilir', () => {
    const r = readDxf(dxf(line(0, 0, 10, 0), line(10, 0, 10, 5), line(10, 5, 0, 5), line(0, 5, 0, 0)));
    expect(r.paths).toHaveLength(4);
    const chained = chainPaths(r.paths, 1e-6);
    expect(chained).toHaveLength(1);
    expect(chained[0].closed).toBe(true);
    expect(chained[0].pts).toHaveLength(4);
    expect(bbox(r.paths.flatMap((p) => p.pts)).minY).toBe(-5);
  });

  it('LWPOLYLINE (yaylı), CIRCLE, ARC ve bilinmeyen varlıklar', () => {
    const lw = ['0', 'LWPOLYLINE', '8', '0', '90', '2', '70', '1', '10', '0', '20', '0', '42', '1', '10', '10', '20', '0', '42', '1'];
    const circle = ['0', 'CIRCLE', '8', '0', '10', '50', '20', '50', '40', '5'];
    const arc = ['0', 'ARC', '8', '0', '10', '0', '20', '0', '40', '10', '50', '0', '51', '90'];
    const text = ['0', 'TEXT', '8', '0', '1', 'yazı'];
    const r = readDxf(dxf(lw, circle, arc, text));
    expect(r.paths).toHaveLength(3);
    expect(r.skipped).toEqual({ TEXT: 1 });
    // İki yarım daireden oluşan tam daire: çap 10
    const b = bbox(r.paths[0].pts);
    expect(b.maxX - b.minX).toBeCloseTo(10, 1);
    expect(b.maxY - b.minY).toBeCloseTo(10, 1);
    expect(r.paths[0].closed).toBe(true);
    const c = bbox(r.paths[1].pts);
    expect(c.maxX - c.minX).toBeCloseTo(10, 1);
    expect(r.paths[2].closed).toBe(false);
  });

  it('bulge yayı doğru yönde döner', () => {
    // Saat yönü tersine yarım daire (y yukarı): (1,0) → (-1,0) üstten geçer
    const pts = bulgePts([1, 0], [-1, 0], 1);
    expect(Math.max(...pts.map((p) => p[1]))).toBeCloseTo(1, 2);
    expect(pts[pts.length - 1][0]).toBeCloseTo(-1);
  });
});

describe('desene çevirme', () => {
  const panel = readDxf(dxf(
    // Dış kenar 0..200 × 0..100, içinde iki kare boşluk
    line(0, 0, 200, 0), line(200, 0, 200, 100), line(200, 100, 0, 100), line(0, 100, 0, 0),
    line(20, 20, 80, 20), line(80, 20, 80, 80), line(80, 80, 20, 80), line(20, 80, 20, 20),
    line(120, 20, 180, 20), line(180, 20, 180, 80), line(180, 80, 120, 80), line(120, 80, 120, 20),
  )).paths;

  it('kesim dosyası: dış kenar atılır, kapalı şekiller boşluk olur, birim karoya oturur', () => {
    const r = toPattern(panel, { mode: 'slot', dropOuter: true });
    expect(r.droppedOuter).toBe(true);
    expect(r.closedCount).toBe(2);
    expect(r.shapes.every((s) => s.t === 'poly')).toBe(true);
    expect(r.aspect).toBeCloseTo(160 / 60);
    const all = r.shapes.flatMap((s) => (s.t === 'poly' ? s.pts : []));
    expect(bbox(all)).toEqual({ minX: 0, maxX: 1, minY: 0, maxY: 1 });
  });

  it('çubuk kipinde kapalı şekiller kapalı çizgi olur; dış kenar istenirse kalır', () => {
    const r = toPattern(panel, { mode: 'bar', dropOuter: false });
    expect(r.droppedOuter).toBe(false);
    expect(r.shapes).toHaveLength(3);
    expect(r.shapes.every((s) => s.t === 'line' && s.closed)).toBe(true);
    expect(r.aspect).toBeCloseTo(2);
  });

  it('boş ya da tek boyutlu çizimde hata verir', () => {
    expect(() => toPattern([], { mode: 'bar', dropOuter: true })).toThrow();
    expect(() => toPattern([{ pts: [[0, 0], [10, 0]], closed: false }], { mode: 'bar', dropOuter: true })).toThrow();
  });

  it('içe aktarılan desen panelde kesilebilir', () => {
    const r = toPattern(panel, { mode: 'slot', dropOuter: true });
    const custom: CustomPattern = { id: 'ozel-test', name: 'Deneme', kind: 'slot', aspect: r.aspect, symmetry: 'yok', shapes: r.shapes };
    const res = buildPanel({ ...DEFAULT_DESIGN, patternId: custom.id, custom, cols: 2, divider: 10 });
    // Karo başına iki boşluk
    expect(res.stats.holeCount).toBe(2 * res.layout.tiles.length);
    expect(res.stats.islandCount).toBe(0);
    expect(res.layout.tileW / res.layout.tileH).toBeCloseTo(r.aspect, 0);
  });
});

describe('kullanıcı desenleri', () => {
  const base: CustomPattern = { id: 'ozel-a1', name: 'Benim', kind: 'bar', aspect: 1, symmetry: 'yok', shapes: [{ t: 'line', pts: [[0, 0], [0.5, 0.5]] }] };

  it('simetri öğe sayısını çoğaltır', () => {
    expect(applySymmetry(base.shapes, 'yok')).toHaveLength(1);
    expect(applySymmetry(base.shapes, 'ayna')).toHaveLength(2);
    expect(applySymmetry(base.shapes, 'ayna4')).toHaveLength(4);
    expect(applySymmetry(base.shapes, 'dondur4')).toHaveLength(4);
    expect(applySymmetry(base.shapes, 'sekiz')).toHaveLength(8);
    expect(customToDef({ ...base, symmetry: 'sekiz' }).build(0, 0, 1)).toHaveLength(8);
  });

  it('bozuk veriyi ayıklar', () => {
    expect(sanitizeCustom({ id: 'baska' })).toBeNull();
    const s = sanitizeCustom({ id: 'ozel-x', kind: 'zzz', aspect: 99, symmetry: 'hmm', shapes: [
      { t: 'line', pts: [[0, 0], [1, 'a'], [1, 1]] }, { t: 'line', pts: [[0, 0]] }, { t: 'circle', c: [0.5, 0.5], r: -1 }, { t: 'disc', c: [0.5, 0.5], r: 0.2 }, 'x',
    ] })!;
    expect(s.kind).toBe('bar');
    expect(s.aspect).toBe(10);
    expect(s.symmetry).toBe('yok');
    expect(s.name).toBe('Desenim');
    expect(s.shapes).toHaveLength(2);
  });

  it('tasarıma gömülü desen proje dosyasıyla gelir; eşleşmeyen kimlik varsayılana döner', () => {
    const d = normalizeDesign({ ...DEFAULT_DESIGN, patternId: base.id, custom: base });
    expect(d.patternId).toBe(base.id);
    expect(d.custom?.name).toBe('Benim');
    expect(normalizeDesign({ ...DEFAULT_DESIGN, patternId: 'ozel-yok', custom: base }).patternId).toBe(DEFAULT_DESIGN.patternId);
  });
});

describe('yarık türünde kapalı şekiller', () => {
  it('çember ve kapalı çizgi dolu boşluğa döner (halka kesip düşen parça yapmasın)', async () => {
    const { forKind } = await import('../core/patterns/custom');
    const shapes = forKind([{ t: 'circle', c: [0.5, 0.5], r: 0.2 }, { t: 'line', pts: [[0, 0], [1, 0], [1, 1]], closed: true }, { t: 'line', pts: [[0, 0], [1, 1]] }], 'slot');
    expect(shapes.map((s) => s.t)).toEqual(['disc', 'poly', 'line']);
  });
});
