import type { Contour, PanelResult } from '../engine';
import type { MmPt } from '../geometry/clip';

const n = (v: number) => (Math.round(v * 100) / 100).toString();

/** Konturları tek bir SVG yol verisine çevirir. */
export function pathData(contours: { pts: MmPt[] }[]): string {
  return contours.map((c) => (c.pts.length ? `M${c.pts.map(([x, y]) => `${n(x)} ${n(y)}`).join('L')}Z` : '')).join('');
}

export const CUT_COLORS: Record<Contour['kind'], string> = {
  outer: '#dc2626',
  hole: '#2563eb',
  island: '#c026d3',
  mount: '#16a34a',
  slot: '#0891b2',
  part: '#ea580c',
};
export const BEND_COLORS = { arka: '#ca8a04', on: '#7c3aed' };

/**
 * SVG dosyası (gerçek ölçüde, mm).
 * cut: yalnız kesim çizgileri ve büküm işaretleri (lazer / plazma programları için) · filled: dolu görünüm (müşteriye göstermek için)
 */
export function toSvg(r: PanelResult, mode: 'cut' | 'filled', metal = '#27272a'): string {
  const { minX, minY, maxX, maxY } = r.bounds;
  const W = maxX - minX;
  const H = maxY - minY;
  const head = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${n(W)}mm" height="${n(H)}mm" viewBox="${n(minX)} ${n(minY)} ${n(W)} ${n(H)}">\n`;
  let body: string;
  if (mode === 'filled') {
    body = `<rect x="${n(minX)}" y="${n(minY)}" width="${n(W)}" height="${n(H)}" fill="#ffffff"/>\n<path d="${pathData(r.contours)}" fill="${metal}" fill-rule="evenodd"/>\n`;
  } else {
    const kinds: Contour['kind'][] = ['outer', 'hole', 'island', 'mount', 'slot', 'part'];
    body = kinds
      .map((k) => {
        const cs = r.contours.filter((c) => c.kind === k);
        return cs.length ? `<path id="${k}" d="${pathData(cs)}" fill="none" stroke="${CUT_COLORS[k]}" stroke-width="0.2"/>\n` : '';
      })
      .join('');
    body += r.bends.map((b) => `<line class="bukum-${b.kind}" x1="${n(b.a[0])}" y1="${n(b.a[1])}" x2="${n(b.b[0])}" y2="${n(b.b[1])}" stroke="${BEND_COLORS[b.kind]}" stroke-width="0.2" stroke-dasharray="4 2"/>\n`).join('');
  }
  return `${head}${body}</svg>\n`;
}
