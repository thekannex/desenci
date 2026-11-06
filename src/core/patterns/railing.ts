/**
 * Korkuluk ve pencere ferforjesi: karonun gerçek oranına göre çizilir (daire ve kıvrımlar bozulmaz).
 * Çizim gerçek ölçüde yapılır: en = karo oranı (a), boy = 1; sonra birim karoya çevrilir.
 */
import { L, ring } from './shapes';
import type { Pt, Shape } from './shapes';
import type { PatternDef } from './types';
import { arcPts, range, regularPts, spiralPts } from './helpers';

const PI = Math.PI;
const FF = 'Ferforje';

/** Gerçek ölçüdeki noktaları birim karoya çevirir. */
const toUnit = (a: number) => (pts: Pt[]): Pt[] => pts.map(([x, y]) => [x / a, y]);

/** Kapsül (iki ucu yarım daire, oval halka) konturu: ortası cx, üst y1, alt y2, yarı en hw. */
function stadium(cx: number, y1: number, y2: number, hw: number): Pt[] {
  return [
    ...arcPts(cx, y2 - hw, hw, 0, PI, 24),
    ...arcPts(cx, y1 + hw, hw, PI, 2 * PI, 24),
  ];
}

/**
 * Kapsül halkalı balkon korkuluğu: iç içe iki oval halka, ortada onları kesen göbek (rozet), göbekten
 * yanlara komşu karoya uzanan yatay bağlantı; isteğe bağlı üstte çapraz kafesli kuşak.
 */
export function kapsul(band: number, innerRatio: number, a: number): Shape[] {
  const u = toUnit(a);
  const out: Shape[] = [];
  const cx = a / 2;
  let y0 = 0;
  if (band >= 1) {
    const bh = Math.min(0.16, 0.8 * a);
    y0 = bh;
    out.push(L(...u([[0, bh], [a, bh]])));
    for (const i of [0, 1]) {
      const x0 = (i * a) / 2;
      out.push(L(...u([[x0, 0], [x0 + a / 2, bh]])), L(...u([[x0, bh], [x0 + a / 2, 0]])));
    }
  }
  const m = Math.min(0.05, 0.25 * a);
  const yTop = y0 + m;
  const yBot = 1 - m;
  const hw = Math.min(0.4 * a, ((yBot - yTop) / 2) * 0.98);
  const d = hw * (1 - innerRatio);
  const yc = (yTop + yBot) / 2;
  const rc = hw * 1.08;
  out.push(ring(...u(stadium(cx, yTop, yBot, hw))));
  out.push(ring(...u(stadium(cx, yTop + d, yBot - d, hw - d))));
  // Göbek: dış halka, iç halka, sekiz kol
  out.push(ring(...u(regularPts([cx, yc], 48, rc, 0))), ring(...u(regularPts([cx, yc], 32, rc * 0.5, 0))), ring(...u(regularPts([cx, yc], 16, rc * 0.2, 0))));
  for (const i of range(8)) {
    const t = (i * PI) / 4 + PI / 8;
    out.push(L(...u([[cx + rc * 0.2 * Math.cos(t), yc + rc * 0.2 * Math.sin(t)], [cx + rc * Math.cos(t), yc + rc * Math.sin(t)]])));
  }
  // Bağlantılar: üst / alt kenara dik, yanlara yatay (komşu karonun göbeğine)
  out.push(L(...u([[cx, y0], [cx, yTop]])), L(...u([[cx, yBot], [cx, 1]])));
  out.push(L(...u([[0, yc], [cx - rc, yc]])), L(...u([[cx + rc, yc], [a, yc]])));
  return out;
}

/** Sarmalın belli tur kesrindeki noktası. */
const at = (sp: Pt[], turns: number, frac: number) => sp[Math.round(((sp.length - 1) * frac) / turns)];

/**
 * Ferforje pencere: her karoda bir dik çubuk; b yüksekliğinde çubuğa takılı, iki yana açılan C kıvrımlar
 * ve ortada küçük çiçek (yan yana karolarda yatay kıvrım kuşağı olur); altta ve üstte küçük kıvrımlar.
 */
export function pencere(b: number, size: number, a: number): Shape[] {
  const u = toUnit(a);
  const cx = a / 2;
  const right: Pt[][] = [];
  const r = 0.26 * a * size;
  const turns = 1.4;
  // Kuşak: çubuktan iki yana açılan C kıvrım; komşu çubuğun kıvrımıyla sırt sırta gelir
  const up = spiralPts(cx + r, b, r, r * 0.22, PI, turns, 1);
  right.push(up);
  const far = at(up, turns, 0.5);
  right.push([far, [a, far[1]]]);
  // Alt ve üst küçük kıvrımlar (çubuğa takılı)
  const rr = 0.13 * a * size;
  const yb = Math.max(b + 2.5 * r, 1 - 0.2 * a);
  const yt = Math.min(b - 2.5 * r, 0.2 * a);
  if (yb + rr < 1) right.push(spiralPts(cx + rr, yb, rr, rr * 0.3, PI, 1.1, -1));
  if (yt - rr > 0) right.push(spiralPts(cx + rr, yt, rr, rr * 0.3, PI, 1.1, 1));
  const mirror = (p: Pt[]): Pt[] => p.map(([x, y]) => [a - x, y]);
  const fr = 0.07 * a;
  const petals: Shape[] = [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([sx, sy]) => ring(...u(regularPts([cx + sx * fr, b + sy * fr], 20, 0.045 * a, 0))));
  return [
    L(...u([[cx, 0], [cx, 1]])),
    ...right.map((p) => L(...u(p))),
    ...right.map((p) => L(...u(mirror(p)))),
    ring(...u(regularPts([cx, b], 24, fr, 0))),
    ...petals,
  ];
}

export const RAILING_PATTERNS: PatternDef[] = [
  {
    id: 'kapsul', name: 'Kapsül halkalı korkuluk', kind: 'bar', group: FF, aspect: 0.3,
    param: { label: 'Üst kuşak', min: 0, max: 1, step: 1, def: 1, unit: '', names: ['Yok', 'Çapraz kafes'] },
    param2: { label: 'İç halka', min: 0.3, max: 0.8, step: 0.01, def: 0.6, unit: '' },
    build: (k, k2, a) => kapsul(k, k2, a),
  },
  {
    id: 'ferforje-pencere', name: 'Ferforje pencere', kind: 'bar', group: FF, aspect: 0.15,
    param: { label: 'Kuşak yeri', min: 0.15, max: 0.85, step: 0.01, def: 0.7, unit: '' },
    param2: { label: 'Kıvrım boyu', min: 0.6, max: 1.25, step: 0.05, def: 1, unit: '' },
    build: (k, k2, a) => pencere(k, k2, a),
  },
];
