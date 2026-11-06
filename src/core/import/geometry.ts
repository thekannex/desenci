/** İçe aktarılan çizimi desen birimine (0..1 karo) çevirir. */
import type { Pt, Shape } from '../patterns/shapes';
import { MAX_POINTS } from '../patterns/custom';

/** Dosyadan okunan çizgi (y aşağı doğru). */
export interface RawPath {
  pts: Pt[];
  closed: boolean;
}

export interface ImportOptions {
  /** bar: çizgiler metal çubuk olur; slot: kapalı şekiller kesilip boşluk olur (hazır kesim dosyası) */
  mode: 'bar' | 'slot';
  /** Bütün çizimi çevreleyen dış kenarı (panelin kendi çerçevesi) at */
  dropOuter: boolean;
}

export interface ImportResult {
  shapes: Shape[];
  /** Çizimin eni / boyu */
  aspect: number;
  closedCount: number;
  openCount: number;
  droppedOuter: boolean;
}

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Uçları değen açık çizgileri birleştirir (DXF'te tek tek LINE olarak gelen konturlar için). */
export function chainPaths(paths: RawPath[], tol: number): RawPath[] {
  const closed = paths.filter((p) => p.closed).map((p) => ({ ...p, pts: [...p.pts] }));
  const open = paths.filter((p) => !p.closed && p.pts.length >= 2).map((p) => [...p.pts]);
  const out: RawPath[] = [...closed];
  while (open.length) {
    let cur = open.pop()!;
    let grown = true;
    while (grown) {
      grown = false;
      for (let i = 0; i < open.length; i++) {
        const o = open[i];
        const head = cur[0];
        const tail = cur[cur.length - 1];
        let joined: Pt[] | null = null;
        if (dist(tail, o[0]) <= tol) joined = [...cur, ...o.slice(1)];
        else if (dist(tail, o[o.length - 1]) <= tol) joined = [...cur, ...o.slice(0, -1).reverse()];
        else if (dist(head, o[o.length - 1]) <= tol) joined = [...o, ...cur.slice(1)];
        else if (dist(head, o[0]) <= tol) joined = [...o.slice().reverse(), ...cur.slice(1)];
        if (joined) {
          cur = joined;
          open.splice(i, 1);
          grown = true;
          break;
        }
      }
    }
    if (cur.length >= 4 && dist(cur[0], cur[cur.length - 1]) <= tol) out.push({ pts: cur.slice(0, -1), closed: true });
    else out.push({ pts: cur, closed: false });
  }
  return out;
}

/** Ardışık çok yakın noktaları ayıklar, kapalıda tekrar eden son noktayı atar. */
function tidy(p: RawPath, tol: number): RawPath {
  const pts: Pt[] = [];
  for (const q of p.pts) if (!pts.length || dist(pts[pts.length - 1], q) > tol) pts.push(q);
  if (p.closed && pts.length > 1 && dist(pts[0], pts[pts.length - 1]) <= tol) pts.pop();
  return { pts, closed: p.closed };
}

function bbox(paths: RawPath[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of paths) for (const [x, y] of p.pts) {
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

/** Okunan çizgileri desen öğelerine çevirir. Çizim yoksa ya da tek boyutluysa hata verir. */
export function toPattern(raw: RawPath[], opt: ImportOptions): ImportResult {
  let paths = raw.filter((p) => p.pts.length >= 2 && p.pts.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)));
  if (!paths.length) throw new Error('Dosyada çizgi bulunamadı.');
  let b = bbox(paths);
  const size = Math.max(b.w, b.h);
  if (!(size > 0)) throw new Error('Çizim tek bir noktadan ibaret.');
  const tol = size * 1e-4;
  paths = chainPaths(paths, tol * 5).map((p) => tidy(p, tol)).filter((p) => p.pts.length >= (p.closed ? 3 : 2));

  // Dış kenar: bütün çizimin sınırına oturan kapalı çizgi
  let droppedOuter = false;
  if (opt.dropOuter && paths.length > 1) {
    const i = paths.findIndex((p) => {
      if (!p.closed) return false;
      const pb = bbox([p]);
      return Math.abs(pb.w - b.w) <= size * 0.01 && Math.abs(pb.h - b.h) <= size * 0.01;
    });
    if (i >= 0) {
      paths.splice(i, 1);
      droppedOuter = true;
      b = bbox(paths);
    }
  }
  if (!(b.w > 0) || !(b.h > 0)) throw new Error('Çizimin eni ya da boyu yok (yalnız düz bir çizgi).');

  // Çok noktalı çizimi seyrelt
  const total = paths.reduce((s, p) => s + p.pts.length, 0);
  const step = total > MAX_POINTS * 0.8 ? Math.ceil(total / (MAX_POINTS * 0.8)) : 1;
  const norm = (pts: Pt[]): Pt[] => pts.filter((_, i) => i % step === 0 || i === pts.length - 1).map(([x, y]) => [(x - b.minX) / b.w, (y - b.minY) / b.h]);

  const shapes: Shape[] = paths.map((p): Shape => {
    const pts = norm(p.pts);
    if (!p.closed) return { t: 'line', pts };
    return opt.mode === 'slot' ? { t: 'poly', pts } : { t: 'line', pts, closed: true };
  });
  return {
    shapes,
    aspect: Math.min(10, Math.max(0.1, b.w / b.h)),
    closedCount: paths.filter((p) => p.closed).length,
    openCount: paths.filter((p) => !p.closed).length,
    droppedOuter,
  };
}

/** Yay (bulge / arc) noktaları: p1'den p2'ye, merkez açısı angle (radyan, + saat yönü tersi). */
export function bulgePts(p1: Pt, p2: Pt, bulge: number): Pt[] {
  if (!bulge) return [p1, p2];
  const theta = 4 * Math.atan(bulge);
  const chord = dist(p1, p2);
  if (chord === 0) return [p1];
  const r = chord / (2 * Math.sin(Math.abs(theta) / 2));
  const mx = (p1[0] + p2[0]) / 2;
  const my = (p1[1] + p2[1]) / 2;
  // Kirişin ortasından merkeze (yay hangi yandaysa ters yönde)
  const h = Math.sqrt(Math.max(0, r * r - (chord / 2) ** 2)) * (Math.abs(theta) > Math.PI ? -1 : 1);
  const ux = (p2[0] - p1[0]) / chord;
  const uy = (p2[1] - p1[1]) / chord;
  const s = theta > 0 ? 1 : -1;
  const cx = mx - uy * h * s;
  const cy = my + ux * h * s;
  const a1 = Math.atan2(p1[1] - cy, p1[0] - cx);
  const n = Math.max(4, Math.ceil(Math.abs(theta) / (Math.PI / 24)));
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a1 + (theta * i) / n;
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}
