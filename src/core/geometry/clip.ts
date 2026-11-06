import ClipperLib from 'clipper-lib';

/** mm cinsinden nokta. */
export type MmPt = [number, number];
type Path = ClipperLib.Path;
export type Paths = ClipperLib.Paths;

/** Clipper tamsayı çalışır: 1 birim = 0,01 mm. */
export const SCALE = 100;
/** Yay yaklaşımında en büyük sapma (0,05 mm; plazmanın kesim hassasiyetinin çok altında). */
const ARC_TOLERANCE = 0.05 * SCALE;
/** Bundan yakın ardışık noktalar ve neredeyse doğrusal köşeler ayıklanır (mm). */
const CLEAN_DISTANCE = 0.03;
const MITER_LIMIT = 4;

export const toPath = (pts: MmPt[]): Path => pts.map(([x, y]) => ({ X: Math.round(x * SCALE), Y: Math.round(y * SCALE) }));
export const fromPath = (p: Path): MmPt[] => p.map((q) => [q.X / SCALE, q.Y / SCALE]);
export const rectPath = (x: number, y: number, w: number, h: number): Path => toPath([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);

export type End = 'square' | 'round' | 'closed';
const END_TYPE: Record<End, ClipperLib.EndType> = {
  square: ClipperLib.EndType.etOpenSquare,
  round: ClipperLib.EndType.etOpenRound,
  closed: ClipperLib.EndType.etClosedLine,
};

/** Çizgileri verilen genişlikte şeride çevirir (sonuç birleşik bölgedir). */
export function stroke(groups: { paths: Paths; end: End }[], width: number): Paths {
  const co = new ClipperLib.ClipperOffset(MITER_LIMIT, ARC_TOLERANCE);
  for (const g of groups) if (g.paths.length) co.AddPaths(g.paths, ClipperLib.JoinType.jtMiter, END_TYPE[g.end]);
  const out: Paths = [];
  co.Execute(out, (width / 2) * SCALE);
  return out;
}

/** Kapalı bölgeyi delta (mm) kadar büyütür (eksi: küçültür). */
export function offset(paths: Paths, delta: number, round: boolean): Paths {
  if (!paths.length || delta === 0) return paths;
  const co = new ClipperLib.ClipperOffset(MITER_LIMIT, ARC_TOLERANCE);
  co.AddPaths(ClipperLib.Clipper.CleanPolygons(paths, CLEAN_DISTANCE * SCALE), round ? ClipperLib.JoinType.jtRound : ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);
  const out: Paths = [];
  co.Execute(out, delta * SCALE);
  return out;
}

function boolean(type: ClipperLib.ClipType, subject: Paths, clip: Paths): Paths {
  const c = new ClipperLib.Clipper();
  c.AddPaths(subject, ClipperLib.PolyType.ptSubject, true);
  if (clip.length) c.AddPaths(clip, ClipperLib.PolyType.ptClip, true);
  const out: Paths = [];
  c.Execute(type, out, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  return out;
}

export const union = (a: Paths, b: Paths = []): Paths => boolean(ClipperLib.ClipType.ctUnion, a, b);
export const intersect = (a: Paths, b: Paths): Paths => boolean(ClipperLib.ClipType.ctIntersection, a, b);
export const difference = (a: Paths, b: Paths): Paths => boolean(ClipperLib.ClipType.ctDifference, a, b);

/**
 * Bölgenin iç içe kontur ağacı: derinlik 1 en dıştaki konturlar, 2 onların delikleri…
 * Alanı minArea'dan küçük kontur (kırıntı) içindekilerle birlikte atlanır.
 */
export interface TreeNode { path: Path; depth: number }
export function contourTree(paths: Paths, minArea = 0): TreeNode[] {
  const c = new ClipperLib.Clipper();
  c.AddPaths(paths, ClipperLib.PolyType.ptSubject, true);
  const tree = new ClipperLib.PolyTree();
  c.Execute(ClipperLib.ClipType.ctUnion, tree, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  const out: TreeNode[] = [];
  const walk = (node: ClipperLib.PolyNode, depth: number) => {
    for (const ch of node.Childs()) {
      if (pathArea(ch.Contour()) < minArea) continue;
      out.push({ path: ch.Contour(), depth });
      walk(ch, depth + 1);
    }
  };
  walk(tree, 1);
  return out;
}

/** Konturun alanı (mm², işaretsiz). */
export const pathArea = (p: Path): number => Math.abs(ClipperLib.Clipper.Area(p)) / (SCALE * SCALE);

/** Kapalı konturun çevresi (mm). */
export function perimeter(pts: MmPt[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    s += Math.hypot(x2 - x1, y2 - y1);
  }
  return s;
}

/** Konturun dış konturu (saat yönü tersine) olup olmadığı. */
export const isOuter = (p: Path): boolean => ClipperLib.Clipper.Orientation(p);

/** Açık çizgileri kapalı bölgeye göre kırpar: inside → bölgenin içinde kalan parçalar, outside → dışında kalanlar. */
export function clipOpen(lines: MmPt[][], region: MmPt[], keep: 'inside' | 'outside'): MmPt[][] {
  const c = new ClipperLib.Clipper();
  c.AddPaths(lines.map(toPath), ClipperLib.PolyType.ptSubject, false);
  c.AddPath(toPath(region), ClipperLib.PolyType.ptClip, true);
  const tree = new ClipperLib.PolyTree();
  c.Execute(keep === 'inside' ? ClipperLib.ClipType.ctIntersection : ClipperLib.ClipType.ctDifference, tree, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  return ClipperLib.Clipper.OpenPathsFromPolyTree(tree).map(fromPath);
}
