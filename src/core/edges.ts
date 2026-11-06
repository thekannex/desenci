/**
 * Kenar işlemi: panel kenarına abkantta bükülecek kanat ya da diş–yuva ile takılan ayrı çerçeve şeridi.
 *
 * Ölçü kuralı: tasarımdaki en × boy panelin BİTMİŞ dış ölçüsüdür (bükümden sonra dıştan dışa), kanat
 * yüksekliği de dış ölçüdür. Açınım (düz sac) büküm payıyla hesaplanır:
 *   BA (büküm uzunluğu) = π/2 · (r + K·t),  OSSB (dış geri çekme) = r + t,  BD (büküm payı) = 2·OSSB − BA
 * Desen koordinatları (0..en, 0..boy) değişmez; kanatlar panelin dışına (eksi yöne) taşar.
 */
import type { MmPt } from './geometry/clip';
import { difference, fromPath, pathArea, toPath, union } from './geometry/clip';

export type EdgeSide = 'top' | 'right' | 'bottom' | 'left';
export const EDGE_SIDES: EdgeSide[] = ['top', 'bottom', 'left', 'right'];
export const EDGE_LABELS: Record<EdgeSide, string> = { top: 'Üst', bottom: 'Alt', left: 'Sol', right: 'Sağ' };

/** yok · arka: arkaya 90° büküm · on: öne 90° büküm · serit: diş–yuvalı ayrı çerçeve şeridi */
export type EdgeKind = 'yok' | 'arka' | 'on' | 'serit';
export const EDGE_KIND_LABELS: Record<EdgeKind, string> = { yok: 'Yok', arka: 'Büküm arkaya', on: 'Büküm öne', serit: 'Geçmeli şerit' };

export interface EdgeSetting {
  kind: EdgeKind;
  /** Kanat yüksekliği (dış ölçü) ya da şerit yüksekliği (panelin arka yüzünden), mm */
  height: number;
}
export type Edges = Record<EdgeSide, EdgeSetting>;

export const DEFAULT_EDGES: Edges = {
  top: { kind: 'yok', height: 30 },
  bottom: { kind: 'yok', height: 30 },
  left: { kind: 'yok', height: 30 },
  right: { kind: 'yok', height: 30 },
};

/** Kenar işleminin hesapta kullandığı ayarlar (Design'ın alt kümesi). */
export interface EdgeInput {
  width: number;
  height: number;
  thickness: number;
  frameSide: number;
  frameTopBottom: number;
  edges: Edges;
  bendRadius: number;
  kFactor: number;
  bendNotch: boolean;
  tabLength: number;
  tabSpacing: number;
  slotClearance: number;
  /** Şeridin dış yüzünün panel kenarına uzaklığı; 0 iken şerit kenarla aynı hizada, yuvalar kenardan açık çentik olur */
  stripOffset: number;
}

export interface BendCalc {
  /** Büküm bölgesinin açınımdaki uzunluğu */
  ba: number;
  /** Dış geri çekme: kalıp çizgisinden düz yüzün başladığı yere */
  ossb: number;
  /** Büküm payı: dış ölçüler toplamından düşülen */
  bd: number;
}

export function bendCalc(t: number, r: number, k: number): BendCalc {
  const ba = (Math.PI / 2) * (r + k * t);
  const ossb = r + t;
  return { ba, ossb, bd: 2 * ossb - ba };
}

export const isBend = (k: EdgeKind) => k === 'arka' || k === 'on';

export interface BendMark {
  side: EdgeSide;
  kind: 'arka' | 'on';
  a: MmPt;
  b: MmPt;
}

export interface EdgePart {
  side: EdgeSide;
  name: string;
  /** Yerleştirilmiş (panelin altına dizilmiş) dış kontur */
  pts: MmPt[];
  length: number;
  height: number;
  tabs: number;
}

export interface EdgeResult {
  /** Panelin açınım dış konturu */
  outline: MmPt[];
  /** Panelde şerit dişlerinin gireceği kapalı yuvalar (şerit kenardan içerideyse) */
  slots: MmPt[][];
  /** Kenardan açılan diş çentiği sayısı (şerit kenarla aynı hizadaysa yuva yerine) */
  notchCount: number;
  parts: EdgePart[];
  bends: BendMark[];
  bend: BendCalc;
  warnings: string[];
}

type Rect = [number, number, number, number]; // x0, y0, x1, y1
const rectPts = ([x0, y0, x1, y1]: Rect): MmPt[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const fmt = (v: number) => (Math.round(v * 10) / 10).toLocaleString('tr-TR');

/** Kenar yerel koordinatı (u: kenar boyunca, v: kalıp çizgisinden içeri) → panel koordinatı. */
function toXY(side: EdgeSide, W: number, H: number) {
  return (u: number, v: number): MmPt => {
    switch (side) {
      case 'top': return [u, v];
      case 'bottom': return [u, H - v];
      case 'left': return [v, u];
      case 'right': return [W - v, u];
    }
  };
}
/** Kenarın iki ucundaki komşu kenarlar (u = 0 ve u = boy). */
const NEIGHBORS: Record<EdgeSide, [EdgeSide, EdgeSide]> = { top: ['left', 'right'], bottom: ['left', 'right'], left: ['top', 'bottom'], right: ['top', 'bottom'] };
const horizontal = (s: EdgeSide) => s === 'top' || s === 'bottom';

/** Yerel dikdörtgeni panel koordinatına çevirir. */
function localRect(side: EdgeSide, W: number, H: number, u0: number, u1: number, v0: number, v1: number): MmPt[] {
  const f = toXY(side, W, H);
  return [f(u0, v0), f(u1, v0), f(u1, v1), f(u0, v1)];
}

export const hasEdges = (e: Edges) => EDGE_SIDES.some((s) => e[s].kind !== 'yok');

/** Kenar işlemlerinin açınımını, yuvalarını ve şeritlerini hesaplar. Hiç kenar işlemi yoksa null. */
export function buildEdges(d: EdgeInput): EdgeResult | null {
  if (!hasEdges(d.edges)) return null;
  const W = d.width, H = d.height, t = d.thickness;
  const bend = bendCalc(t, d.bendRadius, d.kFactor);
  const { ossb, ba, bd } = bend;
  const clr = Math.max(1, t / 2);
  const warnings: string[] = [];
  const kind = (s: EdgeSide) => d.edges[s].kind;
  const frameOf = (s: EdgeSide) => (horizontal(s) ? d.frameTopBottom : d.frameSide);
  const len = (s: EdgeSide) => (horizontal(s) ? W : H);

  // --- Büküm: çekirdek dikdörtgen + kanat şeritleri − köşe boşaltmaları − işaret çentikleri ---
  const flangeStart = (s: EdgeSide) => (isBend(kind(s)) ? ossb - ba : 0);
  const core: Rect = [flangeStart('left'), flangeStart('top'), W - flangeStart('right'), H - flangeStart('bottom')];
  const add: MmPt[][] = [rectPts(core)];
  const cut: MmPt[][] = [];
  const bends: BendMark[] = [];
  const vMid = ossb - ba / 2;
  for (const s of EDGE_SIDES) {
    const k = kind(s);
    if (!isBend(k)) continue;
    const h = d.edges[s].height;
    const [n0, n1] = NEIGHBORS[s];
    const a = isBend(kind(n0)) ? ossb + clr : 0;
    const b = len(s) - (isBend(kind(n1)) ? ossb + clr : 0);
    const out = h - bd;
    if (out <= 0) {
      warnings.push(`${EDGE_LABELS[s]} kanat ${fmt(h)} mm çok kısa; büküm payından (${fmt(bd)} mm) uzun olmalı.`);
      continue;
    }
    add.push(localRect(s, W, H, a, b, -out, ossb - ba));
    const f = toXY(s, W, H);
    bends.push({ side: s, kind: k as 'arka' | 'on', a: f(a, vMid), b: f(b, vMid) });
    if (d.bendNotch) {
      // Büküm çizgisinin iki ucunda, abkantta çizgiyi bulmak için küçük V çentik
      const n = Math.max(2, t);
      cut.push([f(a - 1, vMid - n / 2), f(a + n, vMid), f(a - 1, vMid + n / 2)]);
      cut.push([f(b + 1, vMid - n / 2), f(b - n, vMid), f(b + 1, vMid + n / 2)]);
    }
    if (h < 3 * t + d.bendRadius) warnings.push(`${EDGE_LABELS[s]} kanat ${fmt(h)} mm kısa; abkantta tutmak için en az ${fmt(3 * t + d.bendRadius)} mm önerilir.`);
    if (frameOf(s) < ossb + 2 * t) warnings.push(`${EDGE_LABELS[s]} çerçeve ${fmt(frameOf(s))} mm; büküm desene çok yakın, en az ${fmt(ossb + 2 * t)} mm olmalı (yoksa boşluklar bükümde bozulur).`);
  }
  // İki komşu kenar da bükülüyorsa köşede kanatlar çarpışmasın diye köşe boşaltması
  const corners: [EdgeSide, EdgeSide, number, number][] = [['top', 'left', 0, 0], ['top', 'right', W, 0], ['bottom', 'left', 0, H], ['bottom', 'right', W, H]];
  for (const [s1, s2, cx, cy] of corners) {
    if (!isBend(kind(s1)) || !isBend(kind(s2))) continue;
    const r = ossb + clr;
    const sx = cx === 0 ? 1 : -1;
    const sy = cy === 0 ? 1 : -1;
    const x0 = cx - sx * 5, x1 = cx + sx * r, y0 = cy - sy * 5, y1 = cy + sy * r;
    cut.push(rectPts([Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1)]));
  }

  // --- Geçmeli şeritler ---
  const slots: MmPt[][] = [];
  const raw: { side: EdgeSide; length: number; height: number; tabsAt: number[]; tw: number }[] = [];
  const inset = () => Math.max(0, d.stripOffset);
  let notchCount = 0;
  const cl = d.slotClearance;
  for (const s of EDGE_SIDES) {
    if (kind(s) !== 'serit') continue;
    const h = d.edges[s].height;
    const [n0, n1] = NEIGHBORS[s];
    // Yatay şeritler köşede öne geçer; dikey şeritler onların iç yüzüne dayanır
    const endGap = (n: EdgeSide) => {
      if (kind(n) === 'serit') return horizontal(s) ? inset() : inset() + t;
      if (kind(n) === 'arka') return t + 1;
      return 0;
    };
    const us = endGap(n0);
    const ue = len(s) - endGap(n1);
    const L = ue - us;
    if (L <= 0) continue;
    const n = Math.max(2, Math.ceil(L / Math.max(20, d.tabSpacing)));
    const tw = Math.max(4, Math.min(d.tabLength, L / n - 6));
    const centers = Array.from({ length: n }, (_, i) => (L * (i + 0.5)) / n);
    const ins = inset();
    // Yuva kenara 0,5 mm'den yakınsa kenardan açık çentik olur (dişler kenardan girer)
    const open = ins - cl / 2 < 0.5;
    for (const c of centers) {
      const r = localRect(s, W, H, us + c - (tw + cl) / 2, us + c + (tw + cl) / 2, open ? -5 : ins - cl / 2, ins + t + cl / 2);
      if (open) { cut.push(r); notchCount++; } else slots.push(r);
    }
    raw.push({ side: s, length: L, height: h, tabsAt: centers, tw });
    const need = ins + t + cl / 2 + Math.max(2, t);
    if (frameOf(s) < need) warnings.push(`${EDGE_LABELS[s]} çerçeve ${fmt(frameOf(s))} mm; şerit yuvası desene değmesin diye en az ${fmt(need)} mm olmalı.`);
  }

  const flat = difference(union(add.map(toPath)), cut.map(toPath));
  const main = flat.reduce((best, p) => (pathArea(p) > pathArea(best) ? p : best), flat[0]);
  const outline = fromPath(main);

  // Şeritler panelin altına sıra sıra dizilir (diş aşağıda)
  const xs = outline.map((p) => p[0]);
  const ys = outline.map((p) => p[1]);
  const gap = Math.max(10, 3 * t);
  let y = Math.max(...ys) + gap * 2;
  const x0 = Math.min(...xs);
  const parts: EdgePart[] = raw.map((r) => {
    const rects: MmPt[][] = [rectPts([0, 0, r.length, r.height]), ...r.tabsAt.map((c) => rectPts([c - r.tw / 2, r.height - 0.01, c + r.tw / 2, r.height + t]))];
    const shape = union(rects.map(toPath));
    const pts = fromPath(shape[0]).map(([px, py]): MmPt => [px + x0, py + y]);
    y += r.height + t + gap;
    return { side: r.side, name: `${EDGE_LABELS[r.side]} şerit`, pts, length: r.length, height: r.height, tabs: r.tabsAt.length };
  });

  return { outline, slots, notchCount, parts, bends, bend, warnings };
}
