/**
 * Madalyon (göbek): kapı kanadı ya da panel ortasında tek büyük motif. Dış biçim (daire, sekizgen,
 * yıldız, dört yaprak, kemer…) metal bir kontur; içi Selçuklu yıldız geometrisiyle dolu (dolgu çizgileri
 * biçimin içine kırpılır); dört kol madalyonu karonun kenarına (çerçeveye) bağlar, çevresi boştur.
 * Dolgu ağı tek parça olduğundan ve konturu kestiği her yerde ona bağlandığından düşen parça olmaz.
 */
import { L, ring } from './shapes';
import type { Pt, Shape } from './shapes';
import type { PatternDef } from './types';
import { TILINGS, hankin } from './girih';
import type { Tiling, TilingName } from './girih';
import { arcPts, range, regularPts } from './helpers';
import { pointedArc } from './styles';
import { clipOpen } from '../geometry/clip';

interface Fill { name: string; tiling: TilingName; theta: number; delta: number; center: Pt }

/** İç dolgu seçenekleri (döşeme + yıldız açısı + kol aralığı; merkez simetri noktası). */
export const FILLS: Fill[] = [
  { name: 'Selçuklu sekiz kollu yıldız', tiling: 'sekizgen', theta: 67.5, delta: 0, center: [0, 0] },
  { name: 'On iki kollu yıldız', tiling: 'onikigen', theta: 72, delta: 0, center: [0, 0] },
  { name: 'Osmanlı altı kollu yıldız', tiling: 'altigen', theta: 60, delta: 0, center: [0, 0] },
  { name: 'Kahire yıldızı', tiling: 'kahire', theta: 67.5, delta: 0, center: [0, 0] },
  { name: 'Selçuklu çiçek rozeti', tiling: 'kisrombil', theta: 25, delta: 0.4, center: [0, 0] },
  { name: 'Kafes', tiling: 'kare', theta: 45, delta: 0, center: [0.5, 0.5] },
  { name: 'Yıldız ve haç', tiling: 'yildizHac', theta: 60, delta: 0, center: [0, 0] },
  { name: 'Sekiz kollu gül', tiling: 'dortlu', theta: 30, delta: 0, center: [0, 0] },
];

const deg = Math.PI / 180;
const K = 1000;

/** Dolgu çizgileri (döşeme koordinatında) önbellekte: kaydırıcı oynarken döşeme yeniden kurulmasın. */
const lineCache = new Map<string, { lines: Pt[][]; base: Tiling }>();
function fillLines(fill: Fill, density: number) {
  const key = `${fill.tiling}|${fill.theta}|${fill.delta}|${density}`;
  let c = lineCache.get(key);
  if (!c) {
    const base = TILINGS[fill.tiling]();
    const period = Math.max(base.w, base.h);
    const t = TILINGS[fill.tiling]((density * period) / 2 + 2 * period);
    // Çok uzaktaki çokgenler gereksiz: madalyonu kaplayan daire dışındakiler atılır
    const reach = (density * base.w) / 2 + period;
    const near = t.polys.filter((p) => p.some(([x, y]) => Math.hypot(x - fill.center[0], y - fill.center[1]) < reach));
    c = { lines: hankin(near, fill.theta, fill.delta), base };
    if (lineCache.size > 60) lineCache.clear();
    lineCache.set(key, c);
  }
  return c;
} // kırpma hassasiyeti için birim karo büyütmesi

/**
 * Madalyon öğeleri. outline birim karoda (0..1); aspect karonun eni / boyu (dolgu bozulmasın diye
 * gerçek oranda üretilip birime çevrilir); density: madalyonun eninde kaç dolgu birimi.
 */
export function medallion(outline: Pt[], fillNo: number, density: number, aspect = 1): Shape[] {
  const fill = FILLS[Math.min(FILLS.length - 1, Math.max(0, Math.round(fillNo) - 1))];
  const xs = outline.map((p) => p[0]);
  const ys = outline.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const widthReal = (Math.max(...xs) - Math.min(...xs)) * aspect;
  const n = Math.max(1, density);
  const { lines: raw, base } = fillLines(fill, n);
  const s = widthReal / (n * base.w);
  // Döşeme koordinatı → birim karo (x gerçek orandan geri çevrilir)
  const map = ([x, y]: Pt): Pt => [cx + ((x - fill.center[0]) * s) / aspect, cy + (y - fill.center[1]) * s];
  const big = (p: Pt): Pt => [p[0] * K, p[1] * K];
  const small = (p: Pt): Pt => [p[0] / K, p[1] / K];
  const lines = raw.map((pl) => pl.map(map));
  const inside = clipOpen(lines.map((l) => l.map(big)), outline.map(big), 'inside').map((l) => l.map(small));
  // Kollar: karo kenarının ortasından madalyonun konturuna
  const armLines: Pt[][] = [[[cx, 0], [cx, cy]], [[cx, 1], [cx, cy]], [[0, cy], [cx, cy]], [[1, cy], [cx, cy]]];
  const arms = clipOpen(armLines.map((l) => l.map(big)), outline.map(big), 'outside').map((l) => l.map(small));
  return [ring(...outline), ...inside.map((l) => L(...l)), ...arms.map((l) => L(...l))];
}

/**
 * On kollu gül: ortada düzgün ongen, her kenarına düzgün beşgen (144° + 108° + 108° = 360°: köşelerde
 * boşluksuz oturur). Hankin çizgileri ortada on kollu yıldız, çevresinde beş kollu yıldızlar verir.
 * Beşgen uçlarından geçen çember ve dört kol deseni çerçeveye bağlar.
 */
export function rosette10(theta: number, delta: number): Shape[] {
  const t18 = Math.tan(18 * deg), t36 = Math.tan(36 * deg);
  const a10 = 1 / (2 * t18), a5 = 1 / (2 * t36), r5 = 1 / (2 * Math.sin(36 * deg));
  const polys: Pt[][] = [regularPts([0, 0], 10, 1 / (2 * Math.sin(18 * deg)), 0)];
  const rim: Pt[][] = [];
  for (let i = 0; i < 10; i++) {
    const phi = 36 * i + 18;
    const c: Pt = [(a10 + a5) * Math.cos(phi * deg), (a10 + a5) * Math.sin(phi * deg)];
    const p = regularPts(c, 5, r5, (phi + 180 + 36) * deg);
    polys.push(p);
    // Beşgenin dıştaki iki kenarı (uç noktası çembere değer): gülün dış konturu
    rim.push([p[1], p[2], p[3]]);
  }
  const R = 0.46;
  const s = R / (a10 + a5 + r5);
  const lines = [...hankin(polys, theta, delta), ...rim].map((pl) => L(...pl.map(([x, y]): Pt => [0.5 + x * s, 0.5 + y * s])));
  const outline = regularPts([0.5, 0.5], 96, R, 0);
  const big = (p: Pt): Pt => [p[0] * K, p[1] * K];
  const armLines: Pt[][] = [[[0.5, 0], [0.5, 0.5]], [[0.5, 1], [0.5, 0.5]], [[0, 0.5], [0.5, 0.5]], [[1, 0.5], [0.5, 0.5]]];
  const arms = clipOpen(armLines.map((l) => l.map(big)), outline.map(big), 'outside').map((l) => L(...l.map(([x, y]): Pt => [x / K, y / K])));
  return [ring(...outline), ...lines, ...arms];
}

/** n kollu yıldız konturu (dış yarıçap R, iç yarıçap r). */
const starOutline = (n: number, R: number, r: number): Pt[] => range(2 * n).map((i): Pt => {
  const a = -Math.PI / 2 + (i * Math.PI) / n;
  const rr = i % 2 ? r : R;
  return [0.5 + rr * Math.cos(a), 0.5 + rr * Math.sin(a)];
});

/** Dört yaprak (gotik) konturu. */
function quatrefoil(r: number): Pt[] {
  const lobes: [number, number, number][] = [[0.5 + r, 0.5, -90], [0.5, 0.5 + r, 0], [0.5 - r, 0.5, 90], [0.5, 0.5 - r, 180]];
  return lobes.flatMap(([x, y, a0]) => arcPts(x, y, r, a0 * deg, (a0 + 180) * deg, 36).slice(0, -1));
}

/** Sivri kemerli pencere konturu (oranı aspect olan karoda). */
function archOutline(aspect: number): Pt[] {
  const x0 = 0.12 * aspect, x1 = 0.88 * aspect, mid = 0.5 * aspect;
  const left = pointedArc(x0, mid, 0.42, 0.04);
  const right = left.slice(0, -1).reverse().map(([x, y]): Pt => [2 * mid - x, y]);
  return [[x0, 0.95] as Pt, ...left, ...right, [x1, 0.95] as Pt].map(([x, y]): Pt => [x / aspect, y]);
}

const fillParam = (def: number) => ({ label: 'Dolgu deseni', min: 1, max: FILLS.length, step: 1, def, unit: 'no', names: FILLS.map((f) => f.name) });
const densityParam = (def: number) => ({ label: 'Dolgu sıklığı', min: 1, max: 6, step: 0.5, def, unit: '' });
const MG = 'Madalyon / göbek';
const ARCH_ASPECT = 0.7;

function mad(id: string, name: string, outline: () => Pt[], fill: number, density: number, aspect = 1): PatternDef {
  const o = outline();
  return {
    id, name, kind: 'bar', group: MG, param: fillParam(fill), param2: densityParam(density), aspect: aspect === 1 ? undefined : aspect,
    build: (k, k2) => medallion(o, k, k2, aspect),
  };
}

export const MEDALLION_PATTERNS: PatternDef[] = [
  mad('mad-daire', 'Daire madalyon', () => regularPts([0.5, 0.5], 96, 0.42, 0), 2, 2.5),
  mad('mad-sekizgen', 'Sekizgen madalyon', () => regularPts([0.5, 0.5], 8, 0.44, 22.5 * deg), 1, 2),
  mad('mad-yildiz8', 'Sekiz kollu yıldız madalyon', () => starOutline(8, 0.46, 0.46 * 0.7654), 4, 2.5),
  mad('mad-yildiz12', 'On iki kollu yıldız madalyon', () => starOutline(12, 0.46, 0.46 * 0.78), 5, 2),
  mad('mad-dortyaprak', 'Dört yaprak madalyon', () => quatrefoil(0.21), 3, 3),
  mad('mad-baklava', 'Baklava madalyon', () => regularPts([0.5, 0.5], 4, 0.46, -90 * deg), 6, 4),
  mad('mad-kemer', 'Kemerli madalyon', () => archOutline(ARCH_ASPECT), 7, 2, ARCH_ASPECT),
  mad('mad-kare', 'Kare göbek', () => [[0.03, 0.03], [0.97, 0.03], [0.97, 0.97], [0.03, 0.97]], 2, 1.5),
  {
    id: 'gul-10', name: 'On kollu gül', kind: 'bar', group: MG,
    param: { label: 'Yıldız açısı', min: 20, max: 80, step: 0.5, def: 68, unit: '°' },
    param2: { label: 'Kol aralığı', min: 0, max: 0.6, step: 0.01, def: 0 },
    build: (k, k2) => rosette10(k, k2),
  },
];
