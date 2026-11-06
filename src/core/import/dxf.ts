/**
 * DXF okuyucu (ASCII): LINE, LWPOLYLINE, POLYLINE / VERTEX, CIRCLE, ARC, ELLIPSE, SPLINE.
 * Bloklar (INSERT) ve yazılar okunmaz. DXF'te y yukarı doğrudur; çizim y aşağı doğruya çevrilir.
 */
import type { Pt } from '../patterns/shapes';
import { bulgePts } from './geometry';
import type { RawPath } from './geometry';

export interface DxfRead {
  paths: RawPath[];
  /** Okunamayan varlık türleri ve sayıları */
  skipped: Record<string, number>;
}

type Pair = [number, string];

function pairs(text: string): Pair[] {
  const lines = text.split(/\r?\n/);
  const out: Pair[] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = Number.parseInt(lines[i].trim(), 10);
    if (Number.isNaN(code)) continue;
    out.push([code, lines[i + 1].trim()]);
  }
  return out;
}

const circlePts = (cx: number, cy: number, r: number, a0: number, a1: number): Pt[] => {
  const sweep = a1 - a0;
  const n = Math.max(8, Math.ceil(Math.abs(sweep) / (Math.PI / 36)));
  return Array.from({ length: n + 1 }, (_, i): Pt => {
    const a = a0 + (sweep * i) / n;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
};

/** Çokgen köşelerini (bulge yaylarıyla) noktalara açar. */
function verticesToPts(v: { p: Pt; bulge: number }[], closed: boolean): Pt[] {
  const out: Pt[] = [];
  const n = v.length;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const a = v[i];
    const b = v[(i + 1) % n];
    const part = bulgePts(a.p, b.p, a.bulge);
    out.push(...(out.length ? part.slice(1) : part));
  }
  if (closed && out.length > 1) out.pop();
  if (!segs && n) out.push(v[0].p);
  return out;
}

export function readDxf(text: string): DxfRead {
  const all = pairs(text);
  // ENTITIES bölümü (yoksa bütün dosya)
  let start = all.findIndex((p, i) => p[0] === 2 && p[1] === 'ENTITIES' && all[i - 1]?.[1] === 'SECTION');
  start = start < 0 ? 0 : start + 1;
  let end = all.findIndex((p, i) => i > start && p[0] === 0 && p[1] === 'ENDSEC');
  if (end < 0) end = all.length;
  const list = all.slice(start, end);

  // Varlıklara böl
  const entities: { type: string; data: Pair[] }[] = [];
  for (const p of list) {
    if (p[0] === 0) entities.push({ type: p[1], data: [] });
    else entities[entities.length - 1]?.data.push(p);
  }

  const paths: RawPath[] = [];
  const skipped: Record<string, number> = {};
  const num = (d: Pair[], code: number, def = 0) => {
    const f = d.find((p) => p[0] === code);
    return f ? Number(f[1]) : def;
  };

  for (let i = 0; i < entities.length; i++) {
    const { type, data } = entities[i];
    switch (type) {
      case 'LINE':
        paths.push({ pts: [[num(data, 10), num(data, 20)], [num(data, 11), num(data, 21)]], closed: false });
        break;
      case 'LWPOLYLINE': {
        const v: { p: Pt; bulge: number }[] = [];
        let x: number | null = null;
        for (const [c, val] of data) {
          if (c === 10) x = Number(val);
          else if (c === 20 && x !== null) { v.push({ p: [x, Number(val)], bulge: 0 }); x = null; }
          else if (c === 42 && v.length) v[v.length - 1].bulge = Number(val);
        }
        const closed = (num(data, 70) & 1) === 1;
        if (v.length >= 2) paths.push({ pts: verticesToPts(v, closed), closed });
        break;
      }
      case 'POLYLINE': {
        const closed = (num(data, 70) & 1) === 1;
        const v: { p: Pt; bulge: number }[] = [];
        while (i + 1 < entities.length && entities[i + 1].type === 'VERTEX') {
          i++;
          const d = entities[i].data;
          // Çokyüzlü ağ düğümleri (bayrak 128) çizgi değildir
          if (num(d, 70) & 128) continue;
          v.push({ p: [num(d, 10), num(d, 20)], bulge: num(d, 42) });
        }
        if (entities[i + 1]?.type === 'SEQEND') i++;
        if (v.length >= 2) paths.push({ pts: verticesToPts(v, closed), closed });
        break;
      }
      case 'CIRCLE': {
        const pts = circlePts(num(data, 10), num(data, 20), num(data, 40), 0, 2 * Math.PI);
        pts.pop();
        paths.push({ pts, closed: true });
        break;
      }
      case 'ARC': {
        const a0 = (num(data, 50) * Math.PI) / 180;
        let a1 = (num(data, 51) * Math.PI) / 180;
        if (a1 <= a0) a1 += 2 * Math.PI;
        paths.push({ pts: circlePts(num(data, 10), num(data, 20), num(data, 40), a0, a1), closed: false });
        break;
      }
      case 'ELLIPSE': {
        const cx = num(data, 10), cy = num(data, 20);
        const mx = num(data, 11), my = num(data, 21);
        const ratio = num(data, 40, 1);
        const t0 = num(data, 41, 0);
        let t1 = num(data, 42, 2 * Math.PI);
        if (t1 <= t0) t1 += 2 * Math.PI;
        const full = Math.abs(t1 - t0 - 2 * Math.PI) < 1e-6;
        const n = Math.max(16, Math.ceil((t1 - t0) / (Math.PI / 36)));
        const pts: Pt[] = Array.from({ length: n + 1 }, (_, k): Pt => {
          const t = t0 + ((t1 - t0) * k) / n;
          const c = Math.cos(t), s = Math.sin(t);
          return [cx + mx * c - my * ratio * s, cy + my * c + mx * ratio * s];
        });
        if (full) pts.pop();
        paths.push({ pts, closed: full });
        break;
      }
      case 'SPLINE': {
        // Yaklaşık: geçiş noktaları varsa onlar, yoksa kontrol noktaları
        const fit: Pt[] = [];
        const ctrl: Pt[] = [];
        let fx: number | null = null, cxv: number | null = null;
        for (const [c, val] of data) {
          if (c === 11) fx = Number(val);
          else if (c === 21 && fx !== null) { fit.push([fx, Number(val)]); fx = null; }
          else if (c === 10) cxv = Number(val);
          else if (c === 20 && cxv !== null) { ctrl.push([cxv, Number(val)]); cxv = null; }
        }
        const pts = fit.length >= 2 ? fit : ctrl;
        if (pts.length >= 2) paths.push({ pts, closed: (num(data, 70) & 1) === 1 });
        break;
      }
      case 'VERTEX': case 'SEQEND':
        break;
      default:
        skipped[type] = (skipped[type] ?? 0) + 1;
    }
  }
  // y yukarı → y aşağı
  return { paths: paths.map((p) => ({ ...p, pts: p.pts.map(([x, y]): Pt => [x, -y]) })), skipped };
}
