/**
 * SVG okuyucu: path (bütün komutlar), line, polyline, polygon, rect, circle, ellipse; g / svg dönüşümleri
 * (matrix, translate, scale, rotate, skew). Tarayıcıdan bağımsızdır (testte de çalışır).
 * defs, clipPath, mask, symbol, pattern, marker, text içindekiler ve gizli öğeler okunmaz.
 */
import type { Pt } from '../patterns/shapes';
import type { RawPath } from './geometry';

type M = [number, number, number, number, number, number];
const ID: M = [1, 0, 0, 1, 0, 0];
const mul = (m: M, n: M): M => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];
const apply = (m: M, [x, y]: Pt): Pt => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

const NUM = /[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g;
const nums = (s: string | undefined): number[] => (s ? (s.match(NUM) ?? []).map(Number) : []);

export function parseTransform(s: string | undefined): M {
  let m = ID;
  if (!s) return m;
  for (const [, fn, args] of s.matchAll(/(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g)) {
    const a = nums(args);
    let t: M = ID;
    switch (fn) {
      case 'matrix': if (a.length >= 6) t = [a[0], a[1], a[2], a[3], a[4], a[5]]; break;
      case 'translate': t = [1, 0, 0, 1, a[0] ?? 0, a[1] ?? 0]; break;
      case 'scale': t = [a[0] ?? 1, 0, 0, a[1] ?? a[0] ?? 1, 0, 0]; break;
      case 'rotate': {
        const r = ((a[0] ?? 0) * Math.PI) / 180;
        const c = Math.cos(r), sn = Math.sin(r);
        t = [c, sn, -sn, c, 0, 0];
        if (a.length >= 3) t = mul(mul([1, 0, 0, 1, a[1], a[2]], t), [1, 0, 0, 1, -a[1], -a[2]]);
        break;
      }
      case 'skewX': t = [1, 0, Math.tan(((a[0] ?? 0) * Math.PI) / 180), 1, 0, 0]; break;
      case 'skewY': t = [1, Math.tan(((a[0] ?? 0) * Math.PI) / 180), 0, 1, 0, 0]; break;
    }
    m = mul(m, t);
  }
  return m;
}

const cubic = (p0: Pt, p1: Pt, p2: Pt, p3: Pt, n = 16): Pt[] => Array.from({ length: n }, (_, i): Pt => {
  const t = (i + 1) / n, u = 1 - t;
  return [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]];
});
const quad = (p0: Pt, p1: Pt, p2: Pt, n = 12): Pt[] => Array.from({ length: n }, (_, i): Pt => {
  const t = (i + 1) / n, u = 1 - t;
  return [u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]];
});

/** SVG eliptik yayı (uç nokta biçimi) noktalara açar; ilk nokta hariç. */
export function arcPoints(p1: Pt, rxIn: number, ryIn: number, phiDeg: number, large: boolean, sweep: boolean, p2: Pt): Pt[] {
  let rx = Math.abs(rxIn), ry = Math.abs(ryIn);
  if (!rx || !ry) return [p2];
  const phi = (phiDeg * Math.PI) / 180;
  const cp = Math.cos(phi), sp = Math.sin(phi);
  const dx = (p1[0] - p2[0]) / 2, dy = (p1[1] - p2[1]) / 2;
  const x1 = cp * dx + sp * dy, y1 = -sp * dx + cp * dy;
  const lam = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
  const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
  const den = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  const k = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cxp = (k * rx * y1) / ry, cyp = (-k * ry * x1) / rx;
  const cx = cp * cxp - sp * cyp + (p1[0] + p2[0]) / 2;
  const cy = sp * cxp + cp * cyp + (p1[1] + p2[1]) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const t1 = ang(1, 0, (x1 - cxp) / rx, (y1 - cyp) / ry);
  let dt = ang((x1 - cxp) / rx, (y1 - cyp) / ry, (-x1 - cxp) / rx, (-y1 - cyp) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  if (sweep && dt < 0) dt += 2 * Math.PI;
  const n = Math.max(4, Math.ceil(Math.abs(dt) / (Math.PI / 24)));
  return Array.from({ length: n }, (_, i): Pt => {
    const t = t1 + (dt * (i + 1)) / n;
    return [cx + rx * Math.cos(t) * cp - ry * Math.sin(t) * sp, cy + rx * Math.cos(t) * sp + ry * Math.sin(t) * cp];
  });
}

/** SVG path "d" verisini alt çizgilere ayırır. */
export function parsePathData(d: string): RawPath[] {
  const tokens = d.match(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) ?? [];
  const out: RawPath[] = [];
  let cur: Pt[] = [];
  let pos: Pt = [0, 0];
  let start: Pt = [0, 0];
  let lastCtrl: Pt | null = null;
  let lastCmd = '';
  let cmd = '';
  let i = 0;
  const flush = (closed: boolean) => {
    if (cur.length >= 2) out.push({ pts: cur, closed });
    cur = [];
  };
  const n = () => Number(tokens[i++]);
  const hasNum = () => i < tokens.length && !/^[A-Za-z]$/.test(tokens[i]);
  while (i < tokens.length) {
    if (/^[A-Za-z]$/.test(tokens[i])) cmd = tokens[i++];
    else if (!cmd) { i++; continue; }
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const at = (x: number, y: number): Pt => (rel ? [pos[0] + x, pos[1] + y] : [x, y]);
    if (C === 'Z') {
      flush(true);
      pos = start;
      lastCtrl = null;
      lastCmd = 'Z';
      cmd = '';
      continue;
    }
    if (!hasNum()) { cmd = ''; continue; }
    switch (C) {
      case 'M': {
        flush(false);
        pos = at(n(), n());
        start = pos;
        cur = [pos];
        // Ardından gelen sayı çiftleri çizgidir
        cmd = rel ? 'l' : 'L';
        lastCtrl = null;
        break;
      }
      case 'L': pos = at(n(), n()); cur.push(pos); lastCtrl = null; break;
      case 'H': { const x = n(); pos = [rel ? pos[0] + x : x, pos[1]]; cur.push(pos); lastCtrl = null; break; }
      case 'V': { const y = n(); pos = [pos[0], rel ? pos[1] + y : y]; cur.push(pos); lastCtrl = null; break; }
      case 'C': {
        const c1 = at(n(), n()), c2 = at(n(), n()), p = at(n(), n());
        cur.push(...cubic(pos, c1, c2, p));
        lastCtrl = c2; pos = p; break;
      }
      case 'S': {
        const c1: Pt = lastCtrl && /[CS]/i.test(lastCmd) ? [2 * pos[0] - lastCtrl[0], 2 * pos[1] - lastCtrl[1]] : pos;
        const c2 = at(n(), n()), p = at(n(), n());
        cur.push(...cubic(pos, c1, c2, p));
        lastCtrl = c2; pos = p; break;
      }
      case 'Q': {
        const c = at(n(), n()), p = at(n(), n());
        cur.push(...quad(pos, c, p));
        lastCtrl = c; pos = p; break;
      }
      case 'T': {
        const c: Pt = lastCtrl && /[QT]/i.test(lastCmd) ? [2 * pos[0] - lastCtrl[0], 2 * pos[1] - lastCtrl[1]] : pos;
        const p = at(n(), n());
        cur.push(...quad(pos, c, p));
        lastCtrl = c; pos = p; break;
      }
      case 'A': {
        const rx = n(), ry = n(), rot = n(), large = n() !== 0, sw = n() !== 0;
        const p = at(n(), n());
        cur.push(...arcPoints(pos, rx, ry, rot, large, sw, p));
        lastCtrl = null; pos = p; break;
      }
      default: i++;
    }
    if (cur.length === 0) cur = [pos];
    lastCmd = C;
  }
  flush(false);
  return out;
}

const SKIP = new Set(['defs', 'clipPath', 'mask', 'symbol', 'pattern', 'marker', 'style', 'script', 'title', 'desc', 'metadata', 'text', 'image', 'linearGradient', 'radialGradient', 'filter']);

function attrs(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [, k, , v1, v2] of s.matchAll(/([^\s=/>]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) out[k] = v1 ?? v2 ?? '';
  return out;
}

const hidden = (a: Record<string, string>) => a.display === 'none' || a.visibility === 'hidden' || /display\s*:\s*none/.test(a.style ?? '');

export interface SvgRead {
  paths: RawPath[];
  skipped: Record<string, number>;
}

export function readSvg(text: string): SvgRead {
  const clean = text.replace(/<!--[\s\S]*?-->/g, '').replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '').replace(/<\?[\s\S]*?\?>/g, '').replace(/<!DOCTYPE[\s\S]*?>/gi, '');
  const stack: { m: M; skip: boolean }[] = [{ m: ID, skip: false }];
  const paths: RawPath[] = [];
  const skipped: Record<string, number> = {};
  const add = (pts: Pt[], closed: boolean, m: M) => { if (pts.length >= 2) paths.push({ pts: pts.map((p) => apply(m, p)), closed }); };
  const f = (v: string | undefined, def = 0) => { const x = Number.parseFloat(v ?? ''); return Number.isFinite(x) ? x : def; };

  for (const [, close, rawName, attrText, selfClose] of clean.matchAll(/<(\/)?([A-Za-z_][\w:.-]*)([^>]*?)(\/)?>/g)) {
    const name = rawName.replace(/^svg:/, '');
    if (close) { if (stack.length > 1) stack.pop(); continue; }
    const top = stack[stack.length - 1];
    const a = attrs(attrText);
    const skip = top.skip || SKIP.has(name) || hidden(a);
    const m = mul(top.m, parseTransform(a.transform));
    if (!skip) {
      switch (name) {
        case 'path': for (const p of parsePathData(a.d ?? '')) add(p.pts, p.closed, m); break;
        case 'line': add([[f(a.x1), f(a.y1)], [f(a.x2), f(a.y2)]], false, m); break;
        case 'polyline': case 'polygon': {
          const v = nums(a.points);
          const pts: Pt[] = [];
          for (let k = 0; k + 1 < v.length; k += 2) pts.push([v[k], v[k + 1]]);
          add(pts, name === 'polygon', m);
          break;
        }
        case 'rect': {
          const x = f(a.x), y = f(a.y), w = f(a.width), h = f(a.height);
          if (w > 0 && h > 0) add([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], true, m);
          break;
        }
        case 'circle': case 'ellipse': {
          const cx = f(a.cx), cy = f(a.cy);
          const rx = name === 'circle' ? f(a.r) : f(a.rx), ry = name === 'circle' ? f(a.r) : f(a.ry);
          if (rx > 0 && ry > 0) add(Array.from({ length: 72 }, (_, k): Pt => [cx + rx * Math.cos((k * Math.PI) / 36), cy + ry * Math.sin((k * Math.PI) / 36)]), true, m);
          break;
        }
        case 'svg': case 'g': case 'a': case 'switch': break;
        case 'use': skipped.use = (skipped.use ?? 0) + 1; break;
        default: break;
      }
    }
    if (!selfClose) stack.push({ m, skip });
  }
  return { paths, skipped };
}
