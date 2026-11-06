/** Kullanıcının çizdiği ya da SVG / DXF'ten aldığı desenler ("Desenlerim"). */
import { mapShape, rotPt } from './shapes';
import type { Pt, Shape } from './shapes';
import type { PatternDef } from './types';

/** Çizimin karoya çoğaltılması. */
export type Symmetry = 'yok' | 'ayna' | 'ayna4' | 'dondur4' | 'sekiz';

export const SYMMETRY_LABELS: Record<Symmetry, string> = {
  yok: 'Yok',
  ayna: 'Sağ–sol ayna',
  ayna4: 'Dört yöne ayna',
  dondur4: 'Dört yöne döndür',
  sekiz: 'Sekiz yönlü (yıldız)',
};

export interface CustomPattern {
  id: string;
  name: string;
  kind: 'bar' | 'slot';
  /** Karonun eni / boyu */
  aspect: number;
  symmetry: Symmetry;
  shapes: Shape[];
}

export const CUSTOM_GROUP = 'Desenlerim';
export const isCustomId = (id: string) => id.startsWith('ozel-');
export const newCustomId = () => `ozel-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const mirrorX = (s: Shape) => mapShape(s, ([x, y]) => [1 - x, y]);
const mirrorY = (s: Shape) => mapShape(s, ([x, y]) => [x, 1 - y]);
const rotate = (s: Shape, n: number) => mapShape(s, (p) => rotPt(p, n));

/** Simetriye göre çizimi çoğaltır. */
export function applySymmetry(shapes: Shape[], sym: Symmetry): Shape[] {
  switch (sym) {
    case 'yok': return shapes;
    case 'ayna': return [...shapes, ...shapes.map(mirrorX)];
    case 'ayna4': return [...shapes, ...shapes.map(mirrorX), ...shapes.map(mirrorY), ...shapes.map((s) => mirrorX(mirrorY(s)))];
    case 'dondur4': return [0, 1, 2, 3].flatMap((n) => shapes.map((s) => rotate(s, n)));
    case 'sekiz': return [0, 1, 2, 3].flatMap((n) => [...shapes, ...shapes.map(mirrorX)].map((s) => rotate(s, n)));
  }
}

/** Yarık deseninde kapalı çizgi ve çember halka biçiminde kesip ortayı düşürür; onları dolu boşluğa çevirir. */
export function forKind(shapes: Shape[], kind: 'bar' | 'slot'): Shape[] {
  if (kind === 'bar') return shapes;
  return shapes.map((s): Shape => (s.t === 'circle' ? { t: 'disc', c: s.c, r: s.r } : s.t === 'line' && s.closed && s.pts.length >= 3 ? { t: 'poly', pts: s.pts } : s));
}

export function customToDef(c: CustomPattern): PatternDef {
  return { id: c.id, name: c.name, kind: c.kind, group: CUSTOM_GROUP, aspect: c.aspect, build: () => applySymmetry(c.shapes, c.symmetry) };
}

/** Bir desende en çok bu kadar öğe / nokta olabilir (dosyadan gelen aşırı büyük çizimlere karşı). */
export const MAX_SHAPES = 3000;
export const MAX_POINTS = 60000;

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const clampCoord = (v: number) => Math.min(2, Math.max(-1, v));
function pt(v: unknown): Pt | null {
  if (!Array.isArray(v) || v.length < 2 || !finite(v[0]) || !finite(v[1])) return null;
  return [clampCoord(v[0]), clampCoord(v[1])];
}
function pts(v: unknown, min: number): Pt[] | null {
  if (!Array.isArray(v)) return null;
  const out = v.map(pt).filter((p): p is Pt => p !== null);
  return out.length >= min ? out : null;
}

/** Dosyadan / kayıttan gelen deseni doğrular; bozuksa null. */
export function sanitizeCustom(raw: unknown): CustomPattern | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || !isCustomId(r.id)) return null;
  const shapes: Shape[] = [];
  let points = 0;
  for (const s of Array.isArray(r.shapes) ? r.shapes : []) {
    if (shapes.length >= MAX_SHAPES || points >= MAX_POINTS) break;
    if (!s || typeof s !== 'object') continue;
    const o = s as Record<string, unknown>;
    if (o.t === 'line') {
      const p = pts(o.pts, 2);
      if (p) { shapes.push({ t: 'line', pts: p, closed: o.closed === true }); points += p.length; }
    } else if (o.t === 'poly') {
      const p = pts(o.pts, 3);
      if (p) { shapes.push({ t: 'poly', pts: p }); points += p.length; }
    } else if (o.t === 'circle' || o.t === 'disc') {
      const c = pt(o.c);
      if (c && finite(o.r) && o.r > 0 && o.r < 2) shapes.push({ t: o.t, c, r: o.r });
    }
  }
  const sym = (Object.keys(SYMMETRY_LABELS) as Symmetry[]).includes(r.symmetry as Symmetry) ? (r.symmetry as Symmetry) : 'yok';
  return {
    id: r.id,
    name: typeof r.name === 'string' && r.name.trim() ? r.name.trim().slice(0, 60) : 'Desenim',
    kind: r.kind === 'slot' ? 'slot' : 'bar',
    aspect: finite(r.aspect) ? Math.min(10, Math.max(0.1, r.aspect)) : 1,
    symmetry: sym,
    shapes,
  };
}
