/** Roma / Yunan, klasik (ferforje, gotik), modern ve Osmanlı motifleri. */
import { L, circle, disc, mapShape, poly, ring, sym4 } from './shapes';
import type { Pt, Shape } from './shapes';
import type { PatternDef } from './types';
import { arcPts, cubicPts, range, regularPts, seededRandom, spiralPts, unit } from './helpers';
import { voronoiShapes } from './voronoi';

const RY = 'Roma / Yunan';
const KL = 'Klasik';
const FF = 'Ferforje';
const MO = 'Modern';
const PI = Math.PI;
const S3 = Math.sqrt(3);

const mirrorX = (s: Shape) => mapShape(s, ([x, y]) => [1 - x, y]);
const mirrorY = (s: Shape) => mapShape(s, ([x, y]) => [x, 1 - y]);

/** Dairenin noktaları (oranı 1 olmayan desende gerçek ölçüde çizip birime çevirmek için). */
const ringPts = (cx: number, cy: number, r: number, n = 72): Pt[] => regularPts([cx, cy], n, r, 0);

/**
 * Sivri kemerin sol yayının merkezi: yay (a, ys) noktasından çıkıp (m, ya) tepesine varır,
 * merkezi çıkış çizgisi (ys) üzerindedir.
 */
export function pointedArc(a: number, m: number, ys: number, ya: number): Pt[] {
  const h = ys - ya;
  const cx = (a * a - m * m - h * h) / (2 * (a - m));
  const r = Math.abs(cx - a);
  const top = Math.atan2(ya - ys, m - cx) + 2 * PI;
  return arcPts(cx, ys, r, PI, top);
}

/**
 * Bulut kıvrımı: karo n × n hücreye bölünür, her hücrede kalın bir sarmal. Sarmal hücrenin bir kenar
 * ortasından başlar; çeyrek, yarım ve üç çeyrek turdaki noktaları öteki üç kenar ortasına kısa bir
 * boyunla bağlanır. Komşu hücreler kenar ortalarında buluştuğu için desen tek parçadır ve karolar
 * arasında kesintisiz sürer. Komşular çoğunlukla zıt yönde döner (dişli gibi akar).
 */
export function bulutKivrim(n: number, seed: number): Shape[] {
  const rnd = seededRandom(seed * 53 + n * 7);
  const R = 0.5 / n;
  const out: Shape[] = [];
  for (const i of range(n)) {
    for (const j of range(n)) {
      const cx = (i + 0.5) / n;
      const cy = (j + 0.5) / n;
      const a0 = Math.floor(rnd() * 4) * (PI / 2);
      const dir: 1 | -1 = ((i + j) % 2 === 0) !== rnd() < 0.2 ? 1 : -1;
      const turns = 1.55 + rnd() * 0.45;
      const sp = spiralPts(cx, cy, R, R * 0.16, a0, turns, dir);
      out.push(L(...sp));
      for (const k of [1, 2, 3]) {
        const p = sp[Math.round(((sp.length - 1) * (k / 4)) / turns)];
        const a = a0 + dir * k * (PI / 2);
        out.push(L(p, [cx + R * Math.round(Math.cos(a)), cy + R * Math.round(Math.sin(a))]));
      }
    }
  }
  return out;
}

export const STYLE_PATTERNS: PatternDef[] = [
  // --- Roma / Yunan ---
  {
    id: 'menderes', name: 'Menderes', kind: 'bar', group: RY,
    build: () => {
      const g = (...p: Pt[]) => p.map(([x, y]): Pt => [x / 5, y / 5]);
      return [L(...g([0, 4.5], [5, 4.5])), L(...g([3.5, 4.5], [3.5, 0.5], [0.5, 0.5], [0.5, 3.5], [2.5, 3.5], [2.5, 1.5], [1.5, 1.5], [1.5, 2.5]))];
    },
  },
  {
    id: 'balik-pulu', name: 'Balık pulu', kind: 'bar', group: RY, seamless: true,
    build: () => [[0, 0], [1, 0], [0.5, 0.5], [-0.5, 0.5], [1.5, 0.5]].map(([x, y]) => L(...arcPts(x, y, 0.5, 0, PI, 32))),
  },
  {
    id: 'zincir', name: 'Zincir', kind: 'bar', group: RY,
    param: { label: 'Halka', min: 0.26, max: 0.45, step: 0.01, def: 0.32 },
    build: (r) => [0, 0.5, 1].map((x) => circle(x, 0.5, r)),
  },
  {
    id: 'orgu', name: 'Örgü (gülaçi)', kind: 'bar', group: RY,
    param: { label: 'Genlik', min: 0.15, max: 0.42, step: 0.01, def: 0.3 },
    build: (a) => [
      ...[1, -1].map((sg) => L(...range(49).map((i): Pt => [i / 48, 0.5 + sg * a * Math.sin((2 * PI * i) / 48)]))),
      circle(0.25, 0.5, a), circle(0.75, 0.5, a),
    ],
  },
  {
    id: 'pelta', name: 'Pelta (Roma kalkanı)', kind: 'slot', group: RY,
    build: () => {
      const pts: Pt[] = [
        ...arcPts(0.5, 0.5, 0.5, 0, PI, 40),
        ...arcPts(0.25, 0.5, 0.25, PI, 0, 20).slice(1),
        ...arcPts(0.75, 0.5, 0.25, PI, 0, 20).slice(1, -1),
      ];
      return [poly(...pts.map(([x, y]): Pt => [0.1 + 0.8 * x, 0.2 + 1.2 * (y - 0.5)]))];
    },
  },

  // --- Klasik ---
  {
    id: 'kemer', name: 'Yuvarlak kemer', kind: 'bar', group: KL,
    build: () => [L(...arcPts(0.5, 0.5, 0.5, PI, 2 * PI)), L([0.5, 0], [0.5, 1])],
  },
  {
    id: 'sivri-kemer', name: 'Sivri kemer', kind: 'bar', group: KL,
    param: { label: 'Kemer başlangıcı', min: 0.5, max: 0.9, step: 0.01, def: 0.7 },
    build: (ys) => {
      const left = pointedArc(0, 0.5, ys, 0.05);
      return [L(...left), mirrorX(L(...left)), L([0.5, 0], [0.5, 1])];
    },
  },
  {
    id: 'dortyaprak', name: 'Dört yaprak (gotik)', kind: 'bar', group: KL,
    param: { label: 'Yaprak', min: 0.12, max: 0.245, step: 0.005, def: 0.2 },
    build: (r) => sym4(L(...arcPts(0.5 + r, 0.5, r, -PI / 2, PI / 2)), L([1, 1], [0.5 + r, 0.5 + r])),
  },
  {
    id: 'kivrim', name: 'Ferforje kıvrım', kind: 'bar', group: FF,
    param: { label: 'Kıvrım', min: 0.12, max: 0.23, step: 0.005, def: 0.2 },
    build: (r) => {
      const scroll = L(...spiralPts(0.5 + r, 0.25, r, r * 0.3, PI, 1.25, 1));
      return [L([0.5, 0], [0.5, 1]), scroll, mirrorX(scroll), mirrorY(scroll), mirrorX(mirrorY(scroll))];
    },
  },
  {
    id: 'kivrim-cark', name: 'Kıvrım çarkı', kind: 'bar', group: FF,
    param: { label: 'Kıvrım', min: 0.12, max: 0.22, step: 0.005, def: 0.18 },
    build: (r) => sym4(L(...spiralPts(0.5, r, r, r * 0.3, -PI / 2, 1.2, 1))),
  },
  {
    id: 's-kivrim', name: 'S kıvrım', kind: 'bar', group: FF,
    param: { label: 'Kıvrım', min: 0.13, max: 0.2, step: 0.005, def: 0.18 },
    build: (R) => {
      const turns = 1.25;
      const spiral = spiralPts(0.36, 0.3, R, R * 0.3, 0, turns, -1);
      // Sarmalın çeyrek ve yarım turdaki noktaları karo kenarına bağlanır
      const at = (frac: number) => spiral[Math.round(((spiral.length - 1) * frac) / turns)];
      const half: Shape[] = [L(...spiral), L(at(0.25), [at(0.25)[0], 0]), L(at(0.5), [0, at(0.5)[1]])];
      const body = L(...cubicPts([0.36 + R, 0.3], [0.36 + R, 0.45], [0.64 - R, 0.55], [0.64 - R, 0.7]));
      const flip = (s: Shape) => mapShape(s, ([x, y]) => [1 - x, 1 - y]);
      return [...half, ...half.map(flip), body];
    },
  },
  {
    id: 'ogee', name: 'Soğan kemer kafes', kind: 'bar', group: KL, seamless: true, aspect: 0.6,
    param: { label: 'Düğüm çiçeği', min: 0, max: 0.12, step: 0.005, def: 0.07, unit: '' },
    build: (r) => {
      // İki aile dalga: x = j ± ½·sin(2πy); komşu dalgalar teğet değip soğan kemer (ogee) gözleri yapar
      const out: Shape[] = [];
      for (const j of [0, 1]) {
        for (const sg of [1, -1]) out.push(L(...range(49).map((i): Pt => [j + sg * 0.5 * Math.sin((2 * PI * i) / 48), i / 48])));
        if (r > 0) for (const y of [0, 0.5, 1]) out.push(circle(j, y, r));
      }
      return out;
    },
  },
  {
    id: 'halka-kivrim', name: 'Halkalı kıvrım', kind: 'bar', group: FF, seamless: true,
    param: { label: 'Kıvrım turu', min: 0.8, max: 2.2, step: 0.05, def: 1.5, unit: '' },
    build: (turns) => {
      const R = 0.44;
      const r0 = R * 0.8;
      const leafR = 0.11;
      const la = (3 * PI) / 4;
      return [
        circle(0.5, 0.5, R),
        // Ana kıvrım halkanın tepesinden kısa bir boyunla içeri girer
        L([0.5, 0.5 - R], ...spiralPts(0.5, 0.5, r0, 0.06, -PI / 2, turns, 1)),
        L(...spiralPts(0.5 + (R - leafR) * Math.cos(la), 0.5 + (R - leafR) * Math.sin(la), leafR, leafR * 0.25, la, 1.4, -1)),
        ...sym4(L([0.5, 0], [0.5, 0.5 - R])),
      ];
    },
  },
  {
    id: 'baklava-yildiz', name: 'Baklavalı yıldız', kind: 'bar', group: KL, seamless: true,
    param: { label: 'İç baklava', min: 0.25, max: 0.42, step: 0.01, def: 0.34, unit: '' },
    build: (k) => {
      const R = 0.2;
      const star = range(16).map((i): Pt => {
        const a = -PI / 2 + (i * PI) / 8;
        const rr = i % 2 ? R * 0.7654 : R;
        return [0.5 + rr * Math.cos(a), 0.5 + rr * Math.sin(a)];
      });
      return [ring(...star), ring([0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]), ring([0.5, 0.5 - k], [0.5 + k, 0.5], [0.5, 0.5 + k], [0.5 - k, 0.5]),
        ...sym4(L([0.5, 0], [0.5, 0.5 - R]), L([0, 0], [0.25, 0.25]))];
    },
  },
  {
    id: 'bulut-kivrim', name: 'Bulut kıvrımı', kind: 'bar', group: FF, seamless: true,
    param: { label: 'Sıklık', min: 1, max: 8, step: 1, def: 3 },
    param2: { label: 'Çeşit', min: 1, max: 99, step: 1, def: 5, unit: 'no' },
    build: (n, seed) => bulutKivrim(n, seed),
  },
  {
    id: 'kalp-kivrim', name: 'Kalp kıvrım', kind: 'bar', group: FF,
    build: () => {
      const R = 0.17, turns = 1.2;
      const spiral = spiralPts(0.14 + R, 0.4, R, R * 0.3, PI, turns, 1);
      const top = spiral[Math.round(((spiral.length - 1) * 0.25) / turns)];
      const left: Shape[] = [
        L(...cubicPts([0.5, 0.88], [0.4, 0.8], [0.14, 0.62], [0.14, 0.4]), ...spiral.slice(1)),
        L(top, [top[0], 0]),
      ];
      return [...left, ...left.map(mirrorX), L([0.5, 0.88], [0.5, 1])];
    },
  },
  {
    id: 'rozet', name: 'Rozet', kind: 'bar', group: KL,
    build: () => [
      circle(0.5, 0.5, 0.45),
      ...range(6).map((i) => circle(0.5 + 0.225 * Math.cos((i * PI) / 3), 0.5 + 0.225 * Math.sin((i * PI) / 3), 0.225)),
      ...sym4(L([0.5, 0], [0.5, 0.06])),
    ],
  },
  {
    id: 'hayat-cicegi', name: 'Hayat çiçeği', kind: 'bar', group: KL, aspect: 1 / S3, seamless: true,
    build: () => {
      const out: Shape[] = [];
      for (let j = -1; j <= 3; j++) {
        for (let i = -2; i <= 2; i++) {
          const x = i + (j % 2 ? 0.5 : 0);
          const y = (j * S3) / 2;
          if (x < -1 || x > 2) continue;
          out.push(ring(...unit(ringPts(x, y, 1), 1, S3)));
        }
      }
      return out;
    },
  },

  // --- Modern ---
  {
    id: 'voronoi', name: 'Organik hücre', kind: 'bar', group: MO, seamless: true,
    param: { label: 'Hücre sıklığı', min: 2, max: 9, step: 1, def: 4 },
    param2: { label: 'Çeşit', min: 1, max: 99, step: 1, def: 7, unit: 'no' },
    build: (n, seed) => voronoiShapes(n, seed),
  },
  {
    id: 'ritim', name: 'Ritim çubukları', kind: 'bar', group: MO, seamless: true,
    param: { label: 'Çubuk sayısı', min: 2, max: 20, step: 1, def: 9 },
    param2: { label: 'Çeşit', min: 1, max: 99, step: 1, def: 3, unit: 'no' },
    build: (n, seed) => {
      const rnd = seededRandom(seed * 131 + n);
      return range(n).map((i) => {
        const x = (i + 0.5 + 0.7 * (rnd() - 0.5)) / n;
        return L([x, 0], [x, 1]);
      });
    },
  },
  {
    id: 'bambu', name: 'Bambu', kind: 'bar', group: MO,
    param: { label: 'Kamış sayısı', min: 2, max: 12, step: 1, def: 5 },
    param2: { label: 'Çeşit', min: 1, max: 99, step: 1, def: 11, unit: 'no' },
    build: (n, seed) => {
      const rnd = seededRandom(seed * 97 + n);
      const out: Shape[] = range(n - 1).map((i) => L([(i + 1) / n, 0], [(i + 1) / n, 1]));
      for (const c of range(n)) {
        const k = 1 + Math.floor(rnd() * 2);
        for (const _ of range(k)) {
          const y = 0.15 + 0.7 * rnd();
          out.push(L([c / n, y], [(c + 1) / n, y]));
        }
      }
      return out;
    },
  },
  {
    id: 'balik-sirti', name: 'Balıksırtı', kind: 'bar', group: MO, seamless: true,
    param: { label: 'Sıra', min: 2, max: 12, step: 1, def: 5 },
    build: (n) => [
      L([0.5, 0], [0.5, 1]),
      ...range(2 * n + 2).flatMap((i) => {
        const y = (i - n) / n;
        return [L([0, y + 0.5], [0.5, y]), L([0.5, y], [1, y + 0.5])];
      }),
    ],
  },
  {
    id: 'gunes', name: 'Gün doğumu', kind: 'bar', group: MO,
    param: { label: 'Işın sayısı', min: 3, max: 17, step: 1, def: 9 },
    build: (k) => [
      ...range(k).map((i) => {
        const a = PI + (PI * (i + 1)) / (k + 1);
        return L([0.5, 1], [0.5 + 1.5 * Math.cos(a), 1 + 1.5 * Math.sin(a)]);
      }),
      ...[0.3, 0.6, 0.9].map((r) => L(...arcPts(0.5, 1, r, PI, 2 * PI))),
    ],
  },
  {
    id: 'halkalar', name: 'Halkalar', kind: 'bar', group: MO,
    param: { label: 'Halka sayısı', min: 1, max: 6, step: 1, def: 3 },
    build: (n) => [...range(n).map((i) => circle(0.5, 0.5, (0.45 * (i + 1)) / n)), L([0.5, 0], [0.5, 1]), L([0, 0.5], [1, 0.5])],
  },
  {
    id: 'sasirtmali-delik', name: 'Şaşırtmalı delik', kind: 'slot', group: MO, seamless: true,
    param: { label: 'Sıra', min: 2, max: 12, step: 1, def: 5 },
    build: (n) => range(n).flatMap((j) => range(n + 1).map((i) => disc((i + (j % 2 ? 0 : 0.5)) / n, (j + 0.5) / n, 0.3 / n))),
  },
  {
    id: 'gecisli-delik', name: 'Geçişli delik', kind: 'slot', group: MO,
    param: { label: 'Sıra', min: 3, max: 12, step: 1, def: 6 },
    build: (n) => range(n).flatMap((j) => range(n).map((i) => disc((i + 0.5) / n, (j + 0.5) / n, (0.1 + (0.32 * j) / (n - 1)) / n))),
  },
];
