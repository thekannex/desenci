import type { Design } from './design';
import { computeLayout } from './layout';
import type { Layout } from './layout';
import { orient, patternParam, tileAspect } from './patterns/library';
import { resolvePattern } from './patterns/resolve';
import type { PatternDef } from './patterns/library';
import { mapShape } from './patterns/shapes';
import { buildEdges } from './edges';
import type { BendMark, EdgeResult } from './edges';
import type { Pt, Shape } from './patterns/shapes';
import { SCALE, contourTree, difference, fromPath, intersect, isOuter, offset, pathArea, perimeter, rectPath, stroke, toPath, union } from './geometry/clip';
import type { End, MmPt, Paths } from './geometry/clip';

/**
 * Kesim konturu.
 * outer: panelin dış kenarı · hole: desen boşluğu · island: boşluğun içinde kalan, kesilince DÜŞEN metal parça ·
 * mount: bağlantı deliği · slot: geçmeli şerit dişinin gireceği yuva · part: ayrı kesilen parça (şerit)
 */
export interface Contour {
  pts: MmPt[];
  kind: 'outer' | 'hole' | 'island' | 'mount' | 'slot' | 'part';
  area: number;
  length: number;
  /** Ayrı parçanın adı (ör. "Üst şerit") */
  label?: string;
}

export interface Bounds { minX: number; minY: number; maxX: number; maxY: number }

export interface Warning {
  level: 'error' | 'warn' | 'info';
  text: string;
}

export interface Stats {
  cols: number;
  rows: number;
  tileW: number;
  tileH: number;
  holeCount: number;
  islandCount: number;
  mountCount: number;
  /** En dar boşluk ayarı yüzünden kesilmeyen küçük boşluk sayısı */
  droppedHoles: number;
  /** Toplam kesim yolu (mm) */
  cutLength: number;
  /** Delme (kontur) sayısı */
  pierces: number;
  /** Kesim süresi tahmini (dakika) */
  cutMinutes: number;
  panelArea: number; // mm²
  openArea: number; // mm²
  openRatio: number; // 0..1
  metalArea: number; // mm²
  weight: number; // kg
  /** Açınımın (düz sacın) dış ölçüsü; kenar işlemi yoksa panel ölçüsü */
  flatW: number;
  flatH: number;
  slotCount: number;
  partCount: number;
}

export interface PanelResult {
  design: Design;
  layout: Layout;
  pattern: PatternDef;
  /** Kesim sırasına göre: içteki konturlar önce, dış kenar en son */
  contours: Contour[];
  stats: Stats;
  warnings: Warning[];
  /** Büküm çizgileri (kesilmez, işaret) */
  bends: BendMark[];
  /** Kenar işlemi hesabı (yoksa null) */
  edges: EdgeResult | null;
  /** Bütün çizimin sınırları (panel + ayrı parçalar) */
  bounds: Bounds;
}

/** Çeliğin yoğunluğu (kg/mm³). */
export const STEEL_DENSITY = 7.85e-6;
/** Bundan küçük boşluk kırıntısı sayılır (mm²). */
const MIN_HOLE_AREA = 1;

/** Dairenin birim karodaki noktaları (karo dikdörtgense elips olur). */
function circlePts(c: Pt, r: number, sizeMm: number): Pt[] {
  const n = Math.min(180, Math.max(24, Math.ceil((2 * Math.PI * r * sizeMm) / 3)));
  return Array.from({ length: n }, (_, i): Pt => [c[0] + r * Math.cos((2 * Math.PI * i) / n), c[1] + r * Math.sin((2 * Math.PI * i) / n)]);
}

/**
 * Bir karonun boşlukları (karonun sol üst köşesi 0,0; mm).
 * Çubuk deseninde karo eksi metal, yarık deseninde doğrudan yarıklar.
 */
export function tileHoles(shapes: Shape[], kind: PatternDef['kind'], w: number, h: number, width: number): Paths {
  const map = ([x, y]: Pt): MmPt => [x * w, y * h];
  const size = Math.max(w, h);
  const open: Paths = [];
  const closed: Paths = [];
  const fills: Paths = [];
  for (const s of shapes) {
    if (s.t === 'line') (s.closed ? closed : open).push(toPath(s.pts.map(map)));
    else if (s.t === 'circle') closed.push(toPath(circlePts(s.c, s.r, size).map(map)));
    else if (s.t === 'poly') fills.push(toPath(s.pts.map(map)));
    else fills.push(toPath(circlePts(s.c, s.r, size).map(map)));
  }
  const end: End = kind === 'bar' ? 'square' : 'round';
  const strokes = open.length || closed.length ? stroke([{ paths: open, end }, { paths: closed, end: 'closed' }], width) : [];
  const region = union(strokes, fills);
  const tile = [rectPath(0, 0, w, h)];
  return kind === 'bar' ? difference(tile, region) : intersect(region, tile);
}

/**
 * Plazma için boşlukları düzeltir: minGap'ten dar yerler kesilmez (metal kalır),
 * köşelere radius yarıçapı verilir.
 */
export function cleanHoles(holes: Paths, minGap: number, radius: number, maxInner = radius): Paths {
  let h = holes;
  if (minGap > 0) h = offset(offset(h, -minGap / 2, false), minGap / 2, false);
  if (radius > 0) {
    // Boşluğun dışa bakan köşeleri: küçült-büyüt (açma)
    h = offset(offset(h, -radius, true), radius, true);
    // Boşluğa giren sivri metal uçlar: büyüt-küçült (kapama). İnce metali eritip iki boşluğu
    // birleştirmesin diye yarıçap sınırlıdır; yine de boşluk sayısı azalırsa yarıçap küçültülür.
    let r = Math.min(radius, maxInner);
    const before = countOuter(h);
    for (let i = 0; i < 2 && r > 0.2; i++, r /= 2) {
      const closed = offset(offset(h, r, true), -r, true);
      if (countOuter(closed) >= before) { h = closed; break; }
    }
  }
  return h;
}

const translate = (pts: MmPt[], dx: number, dy: number): MmPt[] => pts.map(([x, y]) => [x + dx, y + dy]);

/** Boşluk bölgesini kesim konturlarına çevirir (derinliğe göre boşluk / düşen parça). */
function holeContours(holes: Paths): Contour[] {
  return contourTree(holes, MIN_HOLE_AREA).map((n) => {
    const pts = fromPath(n.path);
    return { pts, kind: n.depth % 2 === 1 ? 'hole' : 'island', area: pathArea(n.path), length: perimeter(pts) };
  });
}

const countOuter = (paths: Paths): number => paths.filter((p) => isOuter(p) && pathArea(p) >= MIN_HOLE_AREA).length;

/** Bağlantı deliklerinin merkezleri (çerçeve şeridinin ortasında). */
export function mountPositions(d: Design): { pts: MmPt[]; skipped: boolean } {
  const need = d.mountDiameter + 4;
  const okTB = d.frameTopBottom >= need;
  const okS = d.frameSide >= need;
  if (!okTB && !okS) return { pts: [], skipped: true };
  const cx = okS ? d.frameSide / 2 : d.frameTopBottom / 2;
  const cy = okTB ? d.frameTopBottom / 2 : d.frameSide / 2;
  const steps = (span: number) => Math.max(1, Math.ceil(span / d.mountSpacing - 1e-9));
  const pts: MmPt[] = [];
  if (okTB) {
    const n = steps(d.width - 2 * cx);
    for (let i = 0; i <= n; i++) {
      const x = cx + ((d.width - 2 * cx) * i) / n;
      pts.push([x, cy], [x, d.height - cy]);
    }
  }
  if (okS) {
    const n = steps(d.height - 2 * cy);
    for (let i = okTB ? 1 : 0; i <= (okTB ? n - 1 : n); i++) {
      const y = cy + ((d.height - 2 * cy) * i) / n;
      pts.push([cx, y], [d.width - cx, y]);
    }
  }
  return { pts, skipped: !okTB || !okS };
}

function circleMm([cx, cy]: MmPt, r: number): MmPt[] {
  const n = Math.max(24, Math.ceil((2 * Math.PI * r) / 1.5));
  return Array.from({ length: n }, (_, i): MmPt => [cx + r * Math.cos((2 * Math.PI * i) / n), cy + r * Math.sin((2 * Math.PI * i) / n)]);
}

const fmt = (v: number) => (Math.round(v * 10) / 10).toLocaleString('tr-TR');

/** Panelin bütün kesim konturlarını, istatistiklerini ve uyarılarını hesaplar. */
export function buildPanel(d: Design): PanelResult {
  const pattern = resolvePattern(d);
  const layout = computeLayout(d, tileAspect(pattern, d.rotate));
  const k = patternParam(pattern, d.params, 1);
  const k2 = patternParam(pattern, d.params, 2);
  const width = pattern.kind === 'bar' ? d.bar : d.slot;
  const warnings: Warning[] = [];
  if (layout.error) warnings.push({ level: 'error', text: layout.error });

  // Desenin kendi yönündeki karo oranı (90° döndürmede ters)
  const realAspect = layout.tileH > 0 ? (d.rotate % 180 === 90 ? layout.tileH / layout.tileW : layout.tileW / layout.tileH) : 1;
  const shapes = pattern.build(k, k2, realAspect);
  /** Döndürme + bir atlayarak aynalama: en çok dört farklı karo */
  const variant = (col: number, row: number) => ({ mx: d.mirrorX && col % 2 === 1, my: d.mirrorY && row % 2 === 1 });
  const variantHoles = new Map<string, Paths>();
  const rawHolesOf = (mx: boolean, my: boolean): Paths => {
    const key = `${mx}|${my}`;
    let h = variantHoles.get(key);
    if (!h) {
      const oriented = shapes.map((s) => mapShape(s, (p) => orient(p, d.rotate, mx, my)));
      h = tileHoles(oriented, pattern.kind, layout.tileW, layout.tileH, width);
      variantHoles.set(key, h);
    }
    return h;
  };

  // Sivri metal uç yuvarlatması: çubuk deseninde çubuk yarı kalınlığını geçmez (çubuk erimesin)
  const innerLimit = pattern.kind === 'bar' ? 0.45 * width : d.cornerRadius;
  let contours: Contour[] = [];
  let droppedHoles = 0;
  if (layout.tiles.length) {
    if (d.divider > 0) {
      // Karolar ayrı: her karo türü bir kez hesaplanır, kopyalanır
      const cache = new Map<string, { contours: Contour[]; dropped: number }>();
      for (const t of layout.tiles) {
        const { mx, my } = variant(t.col, t.row);
        const key = `${mx}|${my}`;
        let c = cache.get(key);
        if (!c) {
          const raw = rawHolesOf(mx, my);
          const clean = cleanHoles(raw, d.minGap, d.cornerRadius, innerLimit);
          const cs = holeContours(clean);
          c = { contours: cs, dropped: Math.max(0, countOuter(raw) - cs.filter((x) => x.kind === 'hole').length) };
          cache.set(key, c);
        }
        droppedHoles += c.dropped;
        for (const ct of c.contours) contours.push({ ...ct, pts: translate(ct.pts, t.x, t.y) });
      }
    } else {
      // Karo arası yoksa komşu karoların boşlukları birleşir. Düzeltme (en dar boşluk, köşe) yereldir:
      // her karo komşularıyla (3 × 3) birlikte düzeltilip kendi alanına kırpılır; büyük birleşik
      // boşluğu tek seferde düzeltmekten çok daha hızlıdır, sonuç aynıdır.
      const move = (paths: Paths, x: number, y: number): Paths => {
        const dx = Math.round(x * SCALE);
        const dy = Math.round(y * SCALE);
        return paths.map((p) => p.map((q) => ({ X: q.X + dx, Y: q.Y + dy })));
      };
      const { cols, rows, tileW, tileH } = layout;
      const pieces = new Map<string, Paths>();
      const all: Paths = [];
      const raw: Paths = [];
      for (const t of layout.tiles) {
        const { mx, my } = variant(t.col, t.row);
        raw.push(...move(rawHolesOf(mx, my), t.x, t.y));
        const key = [d.mirrorX && t.col % 2, d.mirrorY && t.row % 2, t.col > 0, t.col < cols - 1, t.row > 0, t.row < rows - 1].join('|');
        let piece = pieces.get(key);
        if (!piece) {
          const block: Paths = [];
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const c = t.col + dc;
              const r = t.row + dr;
              if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
              const v = variant(c, r);
              block.push(...move(rawHolesOf(v.mx, v.my), dc * tileW, dr * tileH));
            }
          }
          // Düzeltme bir noktada en çok 2 × yarıçap ötesine bakar; blok o kadar payla kırpılır
          const m = 3 * Math.max(d.minGap / 2, d.cornerRadius) + 1;
          const near = intersect(union(block), [rectPath(-m, -m, tileW + 2 * m, tileH + 2 * m)]);
          piece = intersect(cleanHoles(near, d.minGap, d.cornerRadius, innerLimit), [rectPath(0, 0, tileW, tileH)]);
          pieces.set(key, piece);
        }
        all.push(...move(piece, t.x, t.y));
      }
      // Kontur ağacı parçaları birleştirir
      const cs = holeContours(all);
      droppedHoles = Math.max(0, countOuter(union(raw)) - cs.filter((x) => x.kind === 'hole').length);
      contours = cs;
    }
  }

  // Bağlantı delikleri
  if (d.mountHoles) {
    const { pts, skipped } = mountPositions(d);
    for (const c of pts) {
      const ring = circleMm(c, d.mountDiameter / 2);
      contours.push({ pts: ring, kind: 'mount', area: pathArea(toPath(ring)), length: perimeter(ring) });
    }
    if (!pts.length) warnings.push({ level: 'warn', text: `Bağlantı delikleri çerçeveye sığmıyor: çerçeve en az ${fmt(d.mountDiameter + 4)} mm olmalı.` });
    else if (skipped) warnings.push({ level: 'info', text: 'Bağlantı delikleri yalnız yeterince geniş çerçeve kenarlarına kondu.' });
  }

  // Kenar işlemi: büküm kanatlı açınım, geçme yuvaları, ayrı şeritler
  const edges = buildEdges(d);
  if (edges) {
    for (const w of edges.warnings) warnings.push({ level: 'warn', text: w });
    for (const s of edges.slots) contours.push({ pts: s, kind: 'slot', area: pathArea(toPath(s)), length: perimeter(s) });
  }

  // Kesim sırası: önce düşen parçalar (içten dışa), sonra boşluklar, delikler ve yuvalar, panelin dış kenarı, en son ayrı parçalar
  const order: Record<Contour['kind'], number> = { island: 0, hole: 1, mount: 2, slot: 2, outer: 3, part: 4 };
  contours.sort((a, b) => order[a.kind] - order[b.kind]);
  const outerPts: MmPt[] = edges ? edges.outline : [[0, 0], [d.width, 0], [d.width, d.height], [0, d.height]];
  const outerArea = pathArea(toPath(outerPts));
  contours.push({ pts: outerPts, kind: 'outer', area: outerArea, length: perimeter(outerPts) });
  for (const p of edges?.parts ?? []) contours.push({ pts: p.pts, kind: 'part', area: pathArea(toPath(p.pts)), length: perimeter(p.pts), label: p.name });

  // İstatistikler
  const holes = contours.filter((c) => c.kind === 'hole');
  const islands = contours.filter((c) => c.kind === 'island');
  const mounts = contours.filter((c) => c.kind === 'mount');
  const slots = contours.filter((c) => c.kind === 'slot');
  const parts = contours.filter((c) => c.kind === 'part');
  const panelArea = d.width * d.height;
  // Düşen parçalar da boşlukla birlikte gider; açıklık boşluk konturlarının toplam alanıdır
  const openArea = holes.reduce((s, c) => s + c.area, 0) + mounts.reduce((s, c) => s + c.area, 0);
  const slotArea = slots.reduce((s, c) => s + c.area, 0);
  // Metal: açınım − boşluklar − yuvalar + ayrı şeritler
  const metalArea = Math.max(0, outerArea - openArea - slotArea) + parts.reduce((s, c) => s + c.area, 0);
  const ox = outerPts.map((p) => p[0]);
  const oy = outerPts.map((p) => p[1]);
  const cutLength = contours.reduce((s, c) => s + c.length, 0);
  const pierces = contours.length;
  const stats: Stats = {
    cols: layout.cols, rows: layout.rows, tileW: layout.tileW, tileH: layout.tileH,
    holeCount: holes.length, islandCount: islands.length, mountCount: mounts.length, droppedHoles,
    cutLength, pierces, cutMinutes: cutLength / d.cutSpeed + (pierces * d.pierceTime) / 60,
    panelArea, openArea, openRatio: panelArea > 0 ? openArea / panelArea : 0, metalArea,
    weight: metalArea * d.thickness * STEEL_DENSITY,
    flatW: Math.max(...ox) - Math.min(...ox), flatH: Math.max(...oy) - Math.min(...oy),
    slotCount: slots.length, partCount: parts.length,
  };

  // Uyarılar
  if (islands.length) {
    warnings.push({ level: 'warn', text: `${islands.length} yerde boşluğun ortasında kalan metal parça var; kesilince düşer (ekranda kırmızı). Deseni ya da oranı değiştirin.` });
  }
  if (width < d.thickness) {
    warnings.push({ level: 'warn', text: `${pattern.kind === 'bar' ? 'Çubuk kalınlığı' : 'Yarık genişliği'} (${fmt(width)} mm) sac kalınlığından (${fmt(d.thickness)} mm) az; plazmada ${pattern.kind === 'bar' ? 'eriyip eğilebilir' : 'temiz açılmayabilir'}.` });
  }
  if (pattern.kind === 'slot' && layout.tiles.length && d.minGap > 0 && d.slot < d.minGap) {
    warnings.push({ level: 'warn', text: `Yarık genişliği en dar boşluk ayarından (${fmt(d.minGap)} mm) dar; yarıklar kesilmez.` });
  }
  if (droppedHoles > 0) {
    warnings.push({ level: 'info', text: `${droppedHoles} küçük boşluk en dar boşluk ayarı (${fmt(d.minGap)} mm) yüzünden kesilmedi, metal kaldı.` });
  }
  if (layout.tiles.length && !holes.length && !layout.error) {
    warnings.push({ level: 'warn', text: 'Bu ayarlarla kesilecek boşluk kalmadı; çubuğu inceltin ya da karoları büyütün.' });
  }

  const bends = edges?.bends ?? [];
  const allPts = [...outerPts, ...parts.flatMap((p) => p.pts)];
  const bounds: Bounds = {
    minX: Math.min(...allPts.map((p) => p[0])), minY: Math.min(...allPts.map((p) => p[1])),
    maxX: Math.max(...allPts.map((p) => p[0])), maxY: Math.max(...allPts.map((p) => p[1])),
  };
  return { design: d, layout, pattern, contours, stats, warnings, bends, edges, bounds };
}

