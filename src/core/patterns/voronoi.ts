/**
 * Organik hücre (Voronoi) deseni: karo içine hafif rastgele yerleşmiş noktalar, her noktaya en yakın
 * bölge bir hücre. Noktalar karonun dışına da (komşu karolara) kopyalandığı için desen kesintisizdir.
 * Hücre kenarları birbirine bağlı bir ağdır; düşen parça olmaz.
 */
import { ring } from './shapes';
import type { Pt, Shape } from './shapes';
import { range, seededRandom } from './helpers';

/** Çokgeni, s noktasına q noktasından daha yakın yarı düzleme kırpar (Sutherland–Hodgman). */
function clipHalf(poly: Pt[], s: Pt, q: Pt): Pt[] {
  const mx = (s[0] + q[0]) / 2;
  const my = (s[1] + q[1]) / 2;
  const nx = q[0] - s[0];
  const ny = q[1] - s[1];
  const side = (p: Pt) => (p[0] - mx) * nx + (p[1] - my) * ny;
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const fa = side(a);
    const fb = side(b);
    if (fa <= 0) out.push(a);
    if ((fa < 0 && fb > 0) || (fa > 0 && fb < 0)) {
      const t = fa / (fa - fb);
      out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
    }
  }
  return out;
}

/** n × n hücreli, tohumu seed olan kesintisiz Voronoi hücreleri (birim karoda). */
export function voronoiCells(n: number, seed: number): Pt[][] {
  const rnd = seededRandom(seed * 7919 + n * 31);
  const sites: Pt[] = [];
  for (const i of range(n)) for (const j of range(n)) sites.push([(i + 0.5 + 0.8 * (rnd() - 0.5)) / n, (j + 0.5 + 0.8 * (rnd() - 0.5)) / n]);
  const all: Pt[] = [];
  for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) for (const s of sites) all.push([s[0] + dx, s[1] + dy]);
  const reach = 3.5 / n;
  const cells: Pt[][] = [];
  for (const s of sites) {
    let poly: Pt[] = [[s[0] - reach, s[1] - reach], [s[0] + reach, s[1] - reach], [s[0] + reach, s[1] + reach], [s[0] - reach, s[1] + reach]];
    for (const q of all) {
      if (q[0] === s[0] && q[1] === s[1]) continue;
      if (Math.abs(q[0] - s[0]) > 2 * reach || Math.abs(q[1] - s[1]) > 2 * reach) continue;
      poly = clipHalf(poly, s, q);
    }
    // Karoya değen bütün kopyaları
    for (const dx of [-1, 0, 1]) {
      for (const dy of [-1, 0, 1]) {
        const c = poly.map(([x, y]): Pt => [x + dx, y + dy]);
        const xs = c.map((p) => p[0]);
        const ys = c.map((p) => p[1]);
        if (Math.max(...xs) > 0 && Math.min(...xs) < 1 && Math.max(...ys) > 0 && Math.min(...ys) < 1) cells.push(c);
      }
    }
  }
  return cells;
}

export const voronoiShapes = (n: number, seed: number): Shape[] => voronoiCells(n, seed).map((c) => ring(...c));
