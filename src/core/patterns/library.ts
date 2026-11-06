import { L, box, circle, diamond, disc, ring, rotPt, square, sym4 } from './shapes';
import type { Pt, Shape } from './shapes';
import type { PatternDef } from './types';
import { range } from './helpers';
import { GIRIH_PATTERNS } from './girih';
import { STYLE_PATTERNS } from './styles';
import { MEDALLION_PATTERNS } from './medallion';
import { RAILING_PATTERNS } from './railing';

export type { PatternDef, PatternParam } from './types';

const SQRT2 = Math.SQRT2;

/** Merkezi karo ortasında, iç teğet yarıçapı a olan düzgün sekizgen (kenarları yatay / dikey / 45°). */
function octagon(a: number): Shape {
  const R = a / Math.cos(Math.PI / 8);
  return ring(...range(8).map((i): Pt => {
    const t = Math.PI / 8 + (i * Math.PI) / 4;
    return [0.5 + R * Math.cos(t), 0.5 + R * Math.sin(t)];
  }));
}

/** x + y = c doğrusunun birim karoya düşen parçası. */
function antiDiagonal(c: number): Shape {
  return c <= 1 ? L([0, c], [c, 0]) : L([c - 1, 1], [1, c - 1]);
}

const plus = (): Shape[] => [L([0.5, 0], [0.5, 1]), L([0, 0.5], [1, 0.5])];
const cross = (): Shape[] => [L([0, 0], [1, 1]), L([1, 0], [0, 1])];

const BASIC_PATTERNS: PatternDef[] = [
  // --- Düz çizgiler ---
  {
    id: 'cizgili', name: 'Çubuklar', kind: 'bar', group: 'Çizgi',
    param: { label: 'Çubuk sayısı', min: 1, max: 15, step: 1, def: 4 },
    build: (n) => range(n).map((i) => L([0, (i + 1) / (n + 1)], [1, (i + 1) / (n + 1)])),
  },
  {
    id: 'egik', name: 'Eğik çubuklar', kind: 'bar', group: 'Çizgi',
    param: { label: 'Çubuk sayısı', min: 1, max: 15, step: 1, def: 5 },
    build: (n) => range(n).map((i) => antiDiagonal((2 * (i + 1)) / (n + 1))),
  },
  {
    id: 'arti', name: 'Artı', kind: 'bar', group: 'Çizgi',
    build: plus,
  },
  {
    id: 'izgara', name: 'Izgara', kind: 'bar', group: 'Çizgi',
    param: { label: 'Bölme', min: 2, max: 8, step: 1, def: 3 },
    build: (n) => range(n - 1).flatMap((i) => {
      const v = (i + 1) / n;
      return [L([v, 0], [v, 1]), L([0, v], [1, v])];
    }),
  },
  {
    id: 'capraz', name: 'Çapraz', kind: 'bar', group: 'Çizgi',
    build: cross,
  },
  {
    id: 'isin', name: 'Işın', kind: 'bar', group: 'Çizgi',
    build: () => [...plus(), ...cross()],
  },
  {
    id: 'cift-capraz', name: 'Çift çapraz', kind: 'bar', group: 'Çizgi',
    param: { label: 'Aralık', min: 0.08, max: 0.4, step: 0.01, def: 0.22 },
    build: (c) => [L([0, c], [1 - c, 1]), L([c, 0], [1, 1 - c]), L([1, c], [c, 1]), L([1 - c, 0], [0, 1 - c])],
  },
  {
    id: 'hasir', name: 'Hasır', kind: 'bar', group: 'Çizgi',
    param: { label: 'Çizgi sayısı', min: 1, max: 6, step: 1, def: 3 },
    build: (n) => {
      const pos = range(n).map((j) => ((j + 1) * 0.5) / (n + 1));
      return [
        ...plus(),
        ...pos.flatMap((p) => [
          L([0, p], [0.5, p]), L([0.5, 0.5 + p], [1, 0.5 + p]), // sol üst ve sağ alt: yatay
          L([0.5 + p, 0], [0.5 + p, 0.5]), L([p, 0.5], [p, 1]), // sağ üst ve sol alt: dikey
        ]),
      ];
    },
  },
  {
    id: 'tugla', name: 'Tuğla', kind: 'bar', group: 'Çizgi',
    param: { label: 'Sıra', min: 2, max: 10, step: 1, def: 4 },
    build: (n) => [
      ...range(n - 1).map((i) => L([0, (i + 1) / n], [1, (i + 1) / n])),
      ...range(n).flatMap((r) => (r % 2 === 0 ? [0.5] : [0.25, 0.75]).map((x) => L([x, r / n], [x, (r + 1) / n]))),
    ],
  },
  {
    id: 'zikzak', name: 'Zikzak', kind: 'bar', group: 'Çizgi',
    param: { label: 'Sıra', min: 2, max: 10, step: 1, def: 4 },
    build: (n) => range(n + 1).map((i) => {
      const y = (i + 0.5) / n;
      return L([0, y], [0.5, y - 0.5 / n], [1, y]);
    }),
  },
  {
    id: 'dalga', name: 'Dalga', kind: 'bar', group: 'Çizgi',
    param: { label: 'Dalga sayısı', min: 1, max: 10, step: 1, def: 4 },
    build: (n) => range(n).map((i) => {
      const y0 = (i + 0.5) / n;
      const a = 0.28 / n;
      return L(...range(49).map((j): Pt => [j / 48, y0 + a * Math.sin((2 * Math.PI * j) / 48)]));
    }),
  },

  // --- Kare ve baklava ---
  {
    id: 'elmas', name: 'Baklava', kind: 'bar', group: 'Kafes',
    build: () => [diamond(0.5, 0.5, 0.5)],
  },
  {
    id: 'kafes', name: 'Kafes', kind: 'bar', group: 'Kafes',
    build: () => [diamond(0.5, 0.5, 0.5), ...cross()],
  },
  {
    id: 'cift-elmas', name: 'İç içe baklava', kind: 'bar', group: 'Kafes',
    param: { label: 'İç baklava', min: 0.12, max: 0.42, step: 0.01, def: 0.26 },
    build: (k) => [diamond(0.5, 0.5, 0.5), diamond(0.5, 0.5, k), ...sym4(L([0.5, 0], [0.5, 0.5 - k]), L([0, 0], [0.25, 0.25]))],
  },
  {
    id: 'kare-cerceve', name: 'Kare göz', kind: 'bar', group: 'Kafes',
    param: { label: 'Kare boyu', min: 0.2, max: 0.85, step: 0.01, def: 0.5 },
    build: (k) => [square(0.5, 0.5, k), ...sym4(L([0.5, 0], [0.5, 0.5 - k / 2]))],
  },
  {
    id: 'ic-ice-kare', name: 'İç içe kare', kind: 'bar', group: 'Kafes',
    param: { label: 'Dış kare', min: 0.4, max: 0.88, step: 0.01, def: 0.66 },
    build: (k) => {
      const inner = k * 0.45;
      return [square(0.5, 0.5, k), square(0.5, 0.5, inner), ...sym4(L([0, 0], [0.5 - inner / 2, 0.5 - inner / 2]))];
    },
  },
  {
    id: 'pencereli-izgara', name: 'Pencereli ızgara', kind: 'bar', group: 'Kafes',
    param: { label: 'Pencere', min: 0.1, max: 0.42, step: 0.01, def: 0.24 },
    build: (k) => [
      ...[0.25, 0.75].flatMap((v) => [L([v, 0], [v, 1]), L([0, v], [1, v])]),
      ...[0.25, 0.75].flatMap((x) => [0.25, 0.75].map((y) => square(x, y, k))),
    ],
  },
  {
    id: 'yildiz', name: 'Sekiz köşe yıldız', kind: 'bar', group: 'Selçuklu / Osmanlı',
    param: { label: 'Yıldız', min: 0.3, max: 0.68, step: 0.01, def: 0.5 },
    build: (s) => [
      square(0.5, 0.5, s), diamond(0.5, 0.5, s / SQRT2),
      ...sym4(L([0, 0], [0.5 - s / 2, 0.5 - s / 2]), L([0.5, 0], [0.5, 0.5 - s / SQRT2])),
    ],
  },
  {
    id: 'sekizgen', name: 'Sekizgen', kind: 'bar', group: 'Kafes',
    param: { label: 'Sekizgen', min: 0.2, max: 0.46, step: 0.01, def: 0.38 },
    build: (a) => [octagon(a), ...plus(), ...sym4(L([0, 0], [0.5 - a / SQRT2, 0.5 - a / SQRT2]))],
  },
  {
    id: 'capraz-kare', name: 'Çaprazlı kare', kind: 'bar', group: 'Kafes',
    param: { label: 'Kare', min: 0.2, max: 0.7, step: 0.01, def: 0.4 },
    build: (k) => [...cross(), square(0.5, 0.5, k)],
  },
  {
    id: 'arti-elmas', name: 'Artılı baklava', kind: 'bar', group: 'Kafes',
    param: { label: 'Baklava', min: 0.12, max: 0.48, step: 0.01, def: 0.3 },
    build: (k) => [...plus(), diamond(0.5, 0.5, k)],
  },
  {
    id: 'firildak', name: 'Fırıldak', kind: 'bar', group: 'Kafes',
    param: { label: 'Kol', min: 0.15, max: 0.42, step: 0.01, def: 0.3 },
    build: (p) => sym4(L([p, 0], [p, 1 - p])),
  },
  {
    id: 'sarmal', name: 'Sarmal', kind: 'bar', group: 'Roma / Yunan',
    build: () => [L([0.14, 1], [0.14, 0.14], [0.86, 0.14], [0.86, 0.86], [0.38, 0.86], [0.38, 0.38], [0.62, 0.38], [0.62, 0.62], [0.5, 0.62])],
  },

  // --- Daire ---
  {
    id: 'halka', name: 'Halka', kind: 'bar', group: 'Daire',
    param: { label: 'Halka', min: 0.12, max: 0.48, step: 0.01, def: 0.32 },
    build: (r) => [circle(0.5, 0.5, r), ...plus()],
  },
  {
    id: 'dortlu-halka', name: 'Dörtlü halka', kind: 'bar', group: 'Daire',
    param: { label: 'Halka', min: 0.08, max: 0.24, step: 0.01, def: 0.17 },
    build: (r) => [
      ...[0.25, 0.75].flatMap((v) => [L([v, 0], [v, 1]), L([0, v], [1, v])]),
      ...[0.25, 0.75].flatMap((x) => [0.25, 0.75].map((y) => circle(x, y, r))),
    ],
  },
  {
    id: 'cicek', name: 'Çiçek', kind: 'bar', group: 'Daire',
    build: () => [circle(0.25, 0.5, 0.25), circle(0.75, 0.5, 0.25), circle(0.5, 0.25, 0.25), circle(0.5, 0.75, 0.25)],
  },
  {
    id: 'gecme-halka', name: 'Kesişen daireler', kind: 'bar', group: 'Roma / Yunan', seamless: true,
    build: () => [circle(0.5, 0.5, 0.5), circle(0, 0, 0.5), circle(1, 0, 0.5), circle(0, 1, 0.5), circle(1, 1, 0.5)],
  },

  // --- Yarık (dolu sac üstünde kesik) ---
  {
    id: 'yarik', name: 'Yarıklar', kind: 'slot', group: 'Yarık / delik',
    param: { label: 'Yarık sayısı', min: 1, max: 15, step: 1, def: 5 },
    build: (n) => range(n).map((i) => L([0.12, (i + 0.5) / n], [0.88, (i + 0.5) / n])),
  },
  {
    id: 'delikli', name: 'Delikli', kind: 'slot', group: 'Yarık / delik',
    param: { label: 'Sıra', min: 1, max: 10, step: 1, def: 4 },
    build: (n) => range(n).flatMap((i) => range(n).map((j) => disc((i + 0.5) / n, (j + 0.5) / n, 0.3 / n))),
  },
  {
    id: 'kare-delik', name: 'Kare delikli', kind: 'slot', group: 'Yarık / delik',
    param: { label: 'Sıra', min: 1, max: 10, step: 1, def: 2 },
    build: (n) => {
      const m = 0.18 / n;
      return range(n).flatMap((i) => range(n).map((j) => box(i / n + m, j / n + m, 1 / n - 2 * m, 1 / n - 2 * m)));
    },
  },
  {
    id: 'kose-arti', name: 'Köşeli artı', kind: 'slot', group: 'Yarık / delik',
    param: { label: 'Artı', min: 0.1, max: 0.3, step: 0.01, def: 0.2 },
    build: (k) => [L([0.5, 0.5 - k], [0.5, 0.5 + k]), L([0.5 - k, 0.5], [0.5 + k, 0.5]), ...sym4(L([0.12, 0.36], [0.12, 0.12], [0.36, 0.12]))],
  },
  {
    id: 'kose-kare', name: 'Köşeli kare', kind: 'slot', group: 'Yarık / delik',
    param: { label: 'Orta kare', min: 0.1, max: 0.45, step: 0.01, def: 0.28 },
    build: (k) => [box(0.5 - k / 2, 0.5 - k / 2, k, k), ...sym4(L([0.12, 0.4], [0.12, 0.12], [0.4, 0.12]))],
  },
  {
    id: 'x-yarik', name: 'Çapraz yarık', kind: 'slot', group: 'Yarık / delik',
    param: { label: 'Orta boşluk', min: 0.04, max: 0.3, step: 0.01, def: 0.12 },
    build: (k) => sym4(L([0.12, 0.12], [0.5 - k, 0.5 - k])),
  },
];

/** Programdaki bütün hazır desenler. */
export const PATTERNS: PatternDef[] = [...MEDALLION_PATTERNS, ...RAILING_PATTERNS, ...GIRIH_PATTERNS, ...STYLE_PATTERNS, ...BASIC_PATTERNS];

/** Desen seçicideki grup sırası. */
export const PATTERN_GROUPS = ['Madalyon / göbek', 'Selçuklu / Osmanlı', 'Roma / Yunan', 'Klasik', 'Ferforje', 'Modern', 'Kafes', 'Çizgi', 'Daire', 'Yarık / delik'];

export function getPattern(id: string): PatternDef {
  return PATTERNS.find((p) => p.id === id) ?? PATTERNS[0];
}

/** Desen ayarının geçerli değeri (kayıtlı yoksa varsayılan, sınırlar içinde). */
export function patternParam(p: PatternDef, saved: Record<string, number> | undefined, which: 1 | 2 = 1): number {
  const def = which === 1 ? p.param : p.param2;
  if (!def) return 0;
  const v = saved?.[paramKey(p.id, which)];
  if (typeof v !== 'number' || !Number.isFinite(v)) return def.def;
  return Math.min(def.max, Math.max(def.min, v));
}

/** Desen ayarının kayıttaki adı. */
export const paramKey = (id: string, which: 1 | 2) => (which === 1 ? id : `${id}#2`);

/** Karonun eni / boyu: desen oranı, 90° döndürmede ters çevrilir. */
export function tileAspect(p: PatternDef, rotate: number): number {
  const a = p.aspect ?? 1;
  return rotate % 180 === 90 ? 1 / a : a;
}

/** Döndürme (90° adımı) ve aynalamayı birim karo koordinatına uygular. */
export function orient(p: Pt, rotate: number, mirrorX: boolean, mirrorY: boolean): Pt {
  let [x, y] = rotPt(p, rotate / 90);
  if (mirrorX) x = 1 - x;
  if (mirrorY) y = 1 - y;
  return [x, y];
}
