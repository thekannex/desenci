import { describe, expect, it } from 'vitest';
import { DEFAULT_DESIGN, normalizeDesign } from '../core/design';
import type { Design } from '../core/design';
import { bendCalc, buildEdges } from '../core/edges';
import type { EdgeKind, Edges } from '../core/edges';
import { buildPanel } from '../core/engine';
import { toDxf } from '../core/export/dxf';
import type { MmPt } from '../core/geometry/clip';
import { pathArea, toPath } from '../core/geometry/clip';

const edges = (k: Partial<Record<keyof Edges, EdgeKind>>, height = 30): Edges => ({
  top: { kind: k.top ?? 'yok', height }, bottom: { kind: k.bottom ?? 'yok', height },
  left: { kind: k.left ?? 'yok', height }, right: { kind: k.right ?? 'yok', height },
});
const design = (p: Partial<Design>): Design => ({ ...DEFAULT_DESIGN, width: 1000, height: 900, thickness: 3, bendRadius: 3, kFactor: 0.44, bendNotch: false, frameSide: 30, frameTopBottom: 30, ...p });
const area = (pts: MmPt[]) => pathArea(toPath(pts));
const bbox = (pts: MmPt[]) => ({ minX: Math.min(...pts.map((p) => p[0])), maxX: Math.max(...pts.map((p) => p[0])), minY: Math.min(...pts.map((p) => p[1])), maxY: Math.max(...pts.map((p) => p[1])) });

/** Nokta çokgenin içinde mi (ışın yöntemi). */
function inside([x, y]: MmPt, poly: MmPt[]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

describe('büküm payı', () => {
  it('3 mm sac, 3 mm iç yarıçap, K 0,44', () => {
    const b = bendCalc(3, 3, 0.44);
    expect(b.ba).toBeCloseTo((Math.PI / 2) * 4.32, 6);
    expect(b.ossb).toBe(6);
    expect(b.bd).toBeCloseTo(12 - (Math.PI / 2) * 4.32, 6);
  });

  it('kenar işlemi yoksa açınım hesaplanmaz', () => {
    expect(buildEdges(design({}))).toBeNull();
  });
});

describe('büküm kanadı açınımı', () => {
  const bd = bendCalc(3, 3, 0.44).bd;

  it('iki yan kanat: açınım eni = en + 2 × (kanat − büküm payı)', () => {
    const e = buildEdges(design({ edges: edges({ left: 'arka', right: 'arka' }) }))!;
    const b = bbox(e.outline);
    expect(b.maxX - b.minX).toBeCloseTo(1000 + 2 * (30 - bd), 1);
    expect(b.maxY - b.minY).toBeCloseTo(900, 1);
    expect(Math.abs(area(e.outline) / ((1000 + 2 * (30 - bd)) * 900) - 1)).toBeLessThan(1e-4);
    expect(e.bends).toHaveLength(2);
  });

  it('dört kenar bükülünce köşeler boşaltılır, büküm çizgileri doğru yerde', () => {
    const e = buildEdges(design({ edges: edges({ top: 'arka', bottom: 'arka', left: 'on', right: 'on' }) }))!;
    const b = bbox(e.outline);
    expect(b.maxX - b.minX).toBeCloseTo(1000 + 2 * (30 - bd), 1);
    expect(b.maxY - b.minY).toBeCloseTo(900 + 2 * (30 - bd), 1);
    // Köşe boşaltması: köşe noktası açınımda yok, kanatların ortası var
    expect(inside([2, 2], e.outline)).toBe(false);
    expect(inside([500, -10], e.outline)).toBe(true);
    expect(inside([-10, 450], e.outline)).toBe(true);
    expect(inside([500, 450], e.outline)).toBe(true);
    // Sol büküm çizgisi kalıp çizgisinden OSSB − BA/2 içeride
    const { ossb, ba } = bendCalc(3, 3, 0.44);
    const left = e.bends.find((m) => m.side === 'left')!;
    expect(left.kind).toBe('on');
    expect(left.a[0]).toBeCloseTo(ossb - ba / 2, 4);
    expect(left.b[0]).toBeCloseTo(ossb - ba / 2, 4);
    expect(Math.abs(left.b[1] - left.a[1])).toBeLessThan(900);
  });

  it('işaret çentiği konturdan küçük üçgenler keser', () => {
    const plain = buildEdges(design({ edges: edges({ top: 'arka' }) }))!;
    const notched = buildEdges(design({ edges: edges({ top: 'arka' }), bendNotch: true }))!;
    expect(notched.outline.length).toBeGreaterThan(plain.outline.length);
    expect(area(notched.outline)).toBeLessThan(area(plain.outline));
    expect(area(plain.outline) - area(notched.outline)).toBeLessThan(50);
  });

  it('kısa kanatta ve dar çerçevede uyarır', () => {
    expect(buildEdges(design({ edges: edges({ top: 'arka' }, 4) }))!.warnings.join(' ')).toContain('çok kısa');
    expect(buildEdges(design({ edges: edges({ top: 'arka' }, 10) }))!.warnings.join(' ')).toContain('kısa');
    expect(buildEdges(design({ edges: edges({ left: 'arka' }), frameSide: 8 }))!.warnings.join(' ')).toContain('çerçeve');
  });
});

describe('geçmeli şerit kenarla aynı hizada (varsayılan)', () => {
  const e = buildEdges(design({ edges: edges({ top: 'serit', bottom: 'serit', left: 'serit', right: 'serit' }, 40) }))!;

  it('yuvalar kenardan açık çentik olur, kapalı yuva kalmaz', () => {
    expect(e.slots).toHaveLength(0);
    expect(e.notchCount).toBe(e.parts.reduce((s, p) => s + p.tabs, 0));
    // Panelin dış ölçüsü değişmez, kenarda çentikler var
    const b = bbox(e.outline);
    expect(b).toEqual({ minX: 0, maxX: 1000, minY: 0, maxY: 900 });
    expect(e.outline.length).toBe(4 + 4 * e.notchCount);
  });

  it('yatay şerit tam en, dikey şerit iki şeridin arasında; çentikler dişlerle hizalı', () => {
    const top = e.parts.find((p) => p.side === 'top')!;
    const left = e.parts.find((p) => p.side === 'left')!;
    expect(top.length).toBeCloseTo(1000, 6);
    expect(left.length).toBeCloseTo(900 - 2 * 3, 6);
    const n = top.tabs;
    for (let i = 0; i < n; i++) {
      const cx = (1000 * (i + 0.5)) / n;
      // Çentiğin içi (kenarda, sac kalınlığı derinliğinde) boş, yanı dolu
      expect(inside([cx, 1.5], e.outline)).toBe(false);
      expect(inside([cx, 3 + 0.25 + 1], e.outline)).toBe(true);
      expect(inside([cx + 30 / 2 + 2, 1.5], e.outline)).toBe(true);
    }
  });
});

describe('geçmeli şerit çerçeve ortasında', () => {
  const e = buildEdges(design({ edges: edges({ top: 'serit', bottom: 'serit', left: 'serit', right: 'serit' }, 40), stripOffset: 13.5 }))!;

  it('dört şerit, uzunluklar köşede birbirine dayanır', () => {
    expect(e.parts).toHaveLength(4);
    const ins = 30 / 2 - 3 / 2;
    const top = e.parts.find((p) => p.side === 'top')!;
    const left = e.parts.find((p) => p.side === 'left')!;
    expect(top.length).toBeCloseTo(1000 - 2 * ins, 6);
    expect(left.length).toBeCloseTo(900 - 2 * (ins + 3), 6);
    expect(top.tabs).toBe(Math.ceil(top.length / 250));
  });

  it('her diş için bir yuva; yuvalar çerçeve bandında, ölçüsü diş + boşluk', () => {
    expect(e.slots).toHaveLength(e.parts.reduce((s, p) => s + p.tabs, 0));
    for (const s of e.slots) {
      const b = bbox(s);
      const w = b.maxX - b.minX, h = b.maxY - b.minY;
      expect(Math.min(w, h)).toBeCloseTo(3.5, 6);
      expect(Math.max(w, h)).toBeCloseTo(30.5, 6);
      const inFrame = b.maxX <= 30 || b.minX >= 970 || b.maxY <= 30 || b.minY >= 870;
      expect(inFrame).toBe(true);
    }
  });

  it('şeritteki dişler paneldeki yuvalarla hizalı', () => {
    const top = e.parts.find((p) => p.side === 'top')!;
    const pb = bbox(top.pts);
    // Diş uçları (en alttaki noktalar) şeridin başından ölçülür; yuvalar panelde x = 13,5 + diş ortası
    const tabXs = [...new Set(top.pts.filter((p) => Math.abs(p[1] - pb.maxY) < 1e-6).map((p) => Math.round((p[0] - pb.minX) * 100) / 100))].sort((a, b) => a - b);
    const topSlots = e.slots.filter((s) => bbox(s).maxY <= 30).map((s) => bbox(s)).sort((a, b) => a.minX - b.minX);
    expect(topSlots).toHaveLength(top.tabs);
    topSlots.forEach((sb, i) => {
      const slotCenter = (sb.minX + sb.maxX) / 2 - 13.5;
      const tabCenter = (tabXs[2 * i] + tabXs[2 * i + 1]) / 2;
      expect(slotCenter).toBeCloseTo(tabCenter, 1);
    });
    // Diş boyu sac kalınlığı kadar
    expect(pb.maxY - pb.minY).toBeCloseTo(40 + 3, 6);
  });

  it('şeritler panelin altına üst üste binmeden dizilir', () => {
    const boxes = e.parts.map((p) => bbox(p.pts));
    for (const b of boxes) expect(b.minY).toBeGreaterThan(900);
    for (let i = 1; i < boxes.length; i++) expect(boxes[i].minY).toBeGreaterThan(boxes[i - 1].maxY);
  });
});

describe('panel ve dosya', () => {
  it('kenar işlemi panele, istatistiğe ve DXF katmanlarına yansır', () => {
    const plain = buildPanel(design({}));
    const r = buildPanel(design({ edges: edges({ top: 'arka', bottom: 'arka', left: 'serit', right: 'serit' }), stripOffset: 13.5 }));
    expect(r.stats.partCount).toBe(2);
    expect(r.stats.slotCount).toBeGreaterThan(0);
    expect(r.stats.flatH).toBeGreaterThan(900);
    expect(r.stats.weight).toBeGreaterThan(plain.stats.weight);
    expect(r.contours[r.contours.length - 1].kind).toBe('part');
    const dxf = toDxf(r);
    for (const layer of ['BUKUM_ARKAYA', 'GECME_YUVASI', 'PARCA', 'DIS_KONTUR']) expect(dxf).toContain(layer);
    expect((dxf.match(/\r\nLINE\r\n/g) ?? []).length).toBe(2);
    // Bütün koordinatlar sol alt köşeden pozitif
    const nums = dxf.split('\r\n');
    for (let i = 0; i + 1 < nums.length; i += 2) {
      if (nums[i] === '10' || nums[i] === '20') expect(Number(nums[i + 1])).toBeGreaterThanOrEqual(-1e-9);
    }
  });

  it('kenar ayarları kayıttan doğrulanır', () => {
    const d = normalizeDesign({ edges: { top: { kind: 'arka', height: 25 }, left: { kind: 'zzz', height: -3 } }, kFactor: 9 });
    expect(d.edges.top).toEqual({ kind: 'arka', height: 25 });
    expect(d.edges.left).toEqual({ kind: 'yok', height: 1 });
    expect(d.edges.bottom.kind).toBe('yok');
    expect(d.kFactor).toBe(0.5);
  });

  it('karışık kenarlarda (öne büküm + şerit) düşen parça yok, çizim tutarlı', () => {
    const r = buildPanel(design({ edges: edges({ top: 'on', bottom: 'serit', left: 'arka', right: 'serit' }), bendNotch: true }));
    expect(r.stats.islandCount).toBe(0);
    expect(r.contours.filter((c) => c.kind === 'outer')).toHaveLength(1);
    expect(r.bounds.minY).toBeLessThan(0);
  });
});
