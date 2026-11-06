/**
 * Selçuklu / Osmanlı yıldız desenleri: Hankin'in "temas eden çokgenler" yöntemi (1925; Kaplan 2005).
 * Bir çokgen döşemesi kurulur; her kenarın ortasından iki ışın, kenarla "yıldız açısı" yaparak içeri
 * gönderilir ve komşu kenarın ışınıyla buluştuğu yerde kesilir. Döşeme silinir, kalan çizgiler yıldız
 * desenidir. Açı 0° iken döşemenin kendisi (petek, üçgen ağ…), 90°'ye yaklaştıkça çokgen ortasına
 * uzanan ışınlar çıkar. "Kol aralığı" (δ) ışınları kenar ortasından iki yana açar; yıldız uçları kesik,
 * kolları çift çizgili olur.
 *
 * Döşemeler: düzgün çokgenli (Arşimet) döşemeler ve onların eşlenikleri (Laves: Kahire beşgeni,
 * eşkenar dörtgen, uçurtma…). Bütün çizgiler kenarlarda birleştiği için ağ tek parçadır (kesimde
 * düşen parça olmaz); ışınlar çokgen içinde buluşmazsa iki kenar ortası doğrudan birleştirilir.
 */
import { L, circle } from './shapes';
import type { Pt, Shape } from './shapes';
import type { PatternDef } from './types';
import { range, regularPts, unit } from './helpers';

/** Dikdörtgen tekrar birimi (w × h) ve onu (taşarak) kaplayan çokgenler. */
export interface Tiling {
  w: number;
  h: number;
  polys: Pt[][];
}

/** m: tekrar biriminin ne kadar dışına taşan çokgenler de alınsın. */
type Builder = (m?: number) => Tiling;

const S3 = Math.sqrt(3);
const deg = Math.PI / 180;
const EPS = 1e-6;

/** Temel bölgedeki çokgenleri örgü ötelemeleriyle çoğaltır; tekrar birimine (m payıyla) değenleri tutar. */
function repeat(base: Pt[][], a1: Pt, a2: Pt, w: number, h: number, m = EPS): Tiling {
  const polys: Pt[][] = [];
  for (let i = -7; i <= 7; i++) {
    for (let j = -7; j <= 7; j++) {
      const dx = i * a1[0] + j * a2[0];
      const dy = i * a1[1] + j * a2[1];
      for (const p of base) {
        const q = p.map(([x, y]): Pt => [x + dx, y + dy]);
        const xs = q.map((v) => v[0]);
        const ys = q.map((v) => v[1]);
        if (Math.max(...xs) < -m || Math.min(...xs) > w + m || Math.max(...ys) < -m || Math.min(...ys) > h + m) continue;
        polys.push(q);
      }
    }
  }
  return { w, h, polys };
}

/** Altıgen örgü (komşu uzaklığı d) üzerine kurulan döşemeler: düğüm, kenar ortası ve üçgen ortası çokgenleri. */
function hexLattice(d: number, node: (c: Pt) => Pt[], edge?: (c: Pt, a: number) => Pt[], tri?: (c: Pt, up: boolean) => Pt[]): Builder {
  return (m) => {
    const base: Pt[][] = [node([0, 0])];
    if (edge) base.push(edge([d / 2, 0], 0), edge([d / 4, (d * S3) / 4], 60 * deg), edge([-d / 4, (d * S3) / 4], 120 * deg));
    if (tri) base.push(tri([d / 2, (d * S3) / 6], true), tri([d, (d * S3) / 3], false));
    return repeat(base, [d, 0], [d / 2, (d * S3) / 2], d, d * S3, m);
  };
}

/** Çevrel yarıçap: kenarı 1 olan düzgün n-gen. */
const R = (n: number) => 1 / (2 * Math.sin(Math.PI / n));
const centroid = (p: Pt[]): Pt => [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length];
const polar = (c: Pt, r: number, aDeg: number): Pt => [c[0] + r * Math.cos(aDeg * deg), c[1] + r * Math.sin(aDeg * deg)];

/** 3.3.4.3.4 kıvrık kare: ±30° dönük kareler, aralarında eşkenar üçgenler. */
const kivrikKare: Builder = (m) => {
  const D = (1 + S3) / 2;
  const r4 = Math.SQRT1_2;
  const A: Pt = [0, 0];
  const B: Pt = [D, 0];
  const A2: Pt = [D, D];
  const t1: Pt[] = [polar(A, r4, -15), polar(B, r4, 105), polar(A, r4, 75)];
  const t2: Pt[] = [polar(A, r4, 75), polar(B, r4, 105), polar(A2, r4, 165)];
  // B çevresinde -90° döndürülmüş eşleri
  const rot = (p: Pt): Pt => [B[0] + (p[1] - B[1]), B[1] - (p[0] - B[0])];
  const base = [regularPts(A, 4, r4, 75 * deg), regularPts(B, 4, r4, 105 * deg), t1, t2, t1.map(rot), t2.map(rot)];
  return repeat(base, [D, D], [D, -D], 2 * D, 2 * D, m);
};

/** 3.3.3.4.4 uzun üçgen: kare şeritleri ile üçgen şeritleri sırayla. */
const uzunUcgen: Builder = (m) => {
  const h = S3 / 2;
  const base: Pt[][] = [
    [[0, 0], [1, 0], [1, 1], [0, 1]],
    [[0, 1], [1, 1], [0.5, 1 + h]],
    [[1, 1], [1.5, 1 + h], [0.5, 1 + h]],
  ];
  return repeat(base, [1, 0], [0.5, 1 + h], 1, 2 + S3, m);
};

/** İç açı (köşede). */
function cornerAngle(prev: Pt, v: Pt, next: Pt): number {
  const a = Math.atan2(prev[1] - v[1], prev[0] - v[0]);
  const b = Math.atan2(next[1] - v[1], next[0] - v[0]);
  let d = Math.abs(a - b);
  if (d > Math.PI) d = 2 * Math.PI - d;
  return d;
}

/** Eşlenik (Laves) döşeme: her köşe, çevresindeki çokgen ortalarını birleştiren bir çokgen olur. */
function dual(build: Builder): Builder {
  return (m = EPS) => {
    const t = build(m + 4);
    const key = (p: Pt) => `${Math.round(p[0] * 1e5)},${Math.round(p[1] * 1e5)}`;
    const fans = new Map<string, { v: Pt; cs: Pt[]; ang: number }>();
    for (const p of t.polys) {
      const c = centroid(p);
      p.forEach((v, i) => {
        const k = key(v);
        const f = fans.get(k) ?? { v, cs: [], ang: 0 };
        f.cs.push(c);
        f.ang += cornerAngle(p[(i - 1 + p.length) % p.length], v, p[(i + 1) % p.length]);
        fans.set(k, f);
      });
    }
    const polys: Pt[][] = [];
    for (const f of fans.values()) {
      // Köşenin çevresi tamamlanmamışsa (döşemenin kenarı) atlanır
      if (Math.abs(f.ang - 2 * Math.PI) > 1e-6 || f.cs.length < 3) continue;
      const q = [...f.cs].sort((a, b) => Math.atan2(a[1] - f.v[1], a[0] - f.v[0]) - Math.atan2(b[1] - f.v[1], b[0] - f.v[0]));
      const xs = q.map((v) => v[0]);
      const ys = q.map((v) => v[1]);
      if (Math.max(...xs) < -m || Math.min(...xs) > t.w + m || Math.max(...ys) < -m || Math.min(...ys) > t.h + m) continue;
      polys.push(q);
    }
    return { w: t.w, h: t.h, polys };
  };
}

const kare: Builder = (m) => repeat([regularPts([0.5, 0.5], 4, Math.SQRT1_2, 45 * deg)], [1, 0], [0, 1], 1, 1, m);
const altigen: Builder = (m) => repeat([regularPts([0, 0], 6, 1, 30 * deg)], [S3, 0], [S3 / 2, 1.5], S3, 3, m);
const ucgen: Builder = (m) => repeat([[[0, 0], [1, 0], [0.5, S3 / 2]], [[1, 0], [1.5, S3 / 2], [0.5, S3 / 2]]], [1, 0], [0.5, S3 / 2], 1, S3, m);
const sekizgen: Builder = (m) => {
  const p = 1 + Math.SQRT2;
  return repeat([regularPts([0, 0], 8, R(8), 22.5 * deg), regularPts([p / 2, p / 2], 4, Math.SQRT1_2, 0)], [p, 0], [0, p], p, p, m);
};
const onikigen = hexLattice(2 + S3, (c) => regularPts(c, 12, R(12), 15 * deg), undefined, (c, up) => regularPts(c, 3, 1 / S3, (up ? 30 : 90) * deg));
const gul = hexLattice(3 + S3, (c) => regularPts(c, 12, R(12), 15 * deg), (c, a) => regularPts(c, 4, Math.SQRT1_2, a + 45 * deg), (c) => regularPts(c, 6, 1, 0));
const kagome = hexLattice(2, (c) => regularPts(c, 6, 1, 0), undefined, (c, up) => regularPts(c, 3, 1 / S3, (up ? 30 : 90) * deg));
const yildizHac = hexLattice(1 + S3, (c) => regularPts(c, 6, 1, 30 * deg), (c, a) => regularPts(c, 4, Math.SQRT1_2, a + 45 * deg), (c, up) => regularPts(c, 3, 1 / S3, (up ? 90 : 30) * deg));

export const TILINGS = {
  /** 4.4.4.4 kare */
  kare,
  /** 6.6.6 altıgen (petek) */
  altigen,
  /** 3.3.3.3.3.3 üçgen */
  ucgen,
  /** 4.8.8 sekizgen + kare */
  sekizgen,
  /** 3.12.12 onikigen + üçgen */
  onikigen,
  /** 4.6.12 onikigen + altıgen + kare */
  gul,
  /** 3.6.3.6 altıgen + üçgen (kagome) */
  kagome,
  /** 3.4.6.4 altıgen + kare + üçgen */
  yildizHac,
  /** 3.3.4.3.4 kıvrık kare */
  kivrikKare,
  /** 3.3.3.4.4 uzun üçgen */
  uzunUcgen,
  /** Kahire beşgeni (kıvrık karenin eşleniği) */
  kahire: dual(kivrikKare),
  /** Dörtlü üçgen (sekizgen + karenin eşleniği) */
  dortlu: dual(sekizgen),
  /** Üçlü üçgen (3.12.12 eşleniği) */
  ucluUcgen: dual(onikigen),
  /** Kisrombil (4.6.12 eşleniği) */
  kisrombil: dual(gul),
  /** Eşkenar dörtgen / küp kutusu (kagome eşleniği) */
  rombil: dual(kagome),
  /** Uçurtma (3.4.6.4 eşleniği) */
  ucurtma: dual(yildizHac),
  /** Prizma beşgen (uzun üçgen eşleniği) */
  prizma: dual(uzunUcgen),
} satisfies Record<string, Builder>;
export type TilingName = keyof typeof TILINGS;

/** Çokgenin işaretli alanı (köşe sırasını anlamak için). */
export function signedArea(p: Pt[]): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i];
    const [x2, y2] = p[(i + 1) % p.length];
    s += x1 * y2 - x2 * y1;
  }
  return s / 2;
}

/** Nokta dışbükey çokgenin içinde mi (kenarlar dahil). */
function insideConvex(p: Pt, poly: Pt[], sign: number): boolean {
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    if (sign * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) < -1e-9) return false;
  }
  return true;
}

/**
 * Hankin çizgileri. Her çokgende her kenar için: kenar ortasının δ kadar iki yanından çıkan ışınlar
 * komşu kenarın ışınıyla buluşur. delta: yarım kenar boyuna oranı (0..1).
 */
export function hankin(polys: Pt[][], thetaDeg: number, delta = 0): Pt[][] {
  const th = thetaDeg * deg;
  const c = Math.cos(th);
  const s = Math.sin(th);
  const out: Pt[][] = [];
  for (const poly of polys) {
    const n = poly.length;
    const sign = signedArea(poly) > 0 ? 1 : -1;
    const left: Pt[] = [];
    const right: Pt[] = [];
    const dirs: Pt[] = [];
    const norms: Pt[] = [];
    for (let i = 0; i < n; i++) {
      const [x1, y1] = poly[i];
      const [x2, y2] = poly[(i + 1) % n];
      const len = Math.hypot(x2 - x1, y2 - y1);
      const u: Pt = [(x2 - x1) / len, (y2 - y1) / len];
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const off = (delta * len) / 2;
      left.push([mx - u[0] * off, my - u[1] * off]);
      right.push([mx + u[0] * off, my + u[1] * off]);
      dirs.push(u);
      // İçe bakan dik: alan pozitifse sol taraf
      norms.push([-u[1] * sign, u[0] * sign]);
      // Kol aralığı varsa kenar üzerindeki iki çıkış noktası birleşir (ağ kopmasın)
      if (off > 1e-9) out.push([left[i], right[i]]);
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const dA: Pt = [c * dirs[i][0] + s * norms[i][0], c * dirs[i][1] + s * norms[i][1]];
      const dB: Pt = [-c * dirs[j][0] + s * norms[j][0], -c * dirs[j][1] + s * norms[j][1]];
      const A = right[i];
      const B = left[j];
      // A + t·dA = B + u·dB
      const det = dA[0] * -dB[1] - dA[1] * -dB[0];
      const rx = B[0] - A[0];
      const ry = B[1] - A[1];
      let P: Pt | null = null;
      if (Math.abs(det) > 1e-9) {
        const t = (rx * -dB[1] - ry * -dB[0]) / det;
        const u = (dA[0] * ry - dA[1] * rx) / det;
        const q: Pt = [A[0] + t * dA[0], A[1] + t * dA[1]];
        if (t > -1e-9 && u > -1e-9 && insideConvex(q, poly, sign)) P = q;
      }
      // Işınlar çokgen içinde buluşmuyorsa (aynı doğruda karşılaşma, çok geniş açı) iki çıkış noktası doğrudan birleşir
      out.push(P ? [A, P, B] : [A, B]);
    }
  }
  return out;
}

/** Döşeme + açı + kol aralığı → birim karoya çevrilmiş çizgiler. */
export function girihShapes(tiling: Tiling, thetaDeg: number, delta = 0): Shape[] {
  return hankin(tiling.polys, thetaDeg, delta).map((pl) => L(...unit(pl, tiling.w, tiling.h)));
}

/** Kenevir yaprağı (asanoha): üçgen döşeme + her üçgenin ortasından köşelerine çizgiler. */
function asanoha(): Shape[] {
  const t = TILINGS.ucgen();
  const lines: Pt[][] = [];
  for (const p of t.polys) {
    const c = centroid(p);
    for (const v of p) lines.push([c, v]);
    for (let i = 0; i < 3; i++) lines.push([p[i], p[(i + 1) % 3]]);
  }
  return lines.map((pl) => L(...unit(pl, t.w, t.h)));
}

/**
 * Yıldız madalyonu (göbek): n kollu {n/k} yıldız çokgeni, uçlarından karo kenarına uzanan ışınlar;
 * istenirse uçlardan geçen çember. Çizgiler birbirini kestiği için tek parçadır.
 */
export function madalyon(n: number, k: number, ring: boolean, size = 0.42): Shape[] {
  const kk = Math.max(1, Math.min(Math.ceil(n / 2) - 1, Math.round(k)));
  const v = range(n).map((i): Pt => polar([0.5, 0.5], size, -90 + (360 * i) / n));
  const out: Shape[] = range(n).map((i) => L(v[i], v[(i + kk) % n]));
  for (const p of v) {
    const d: Pt = [p[0] - 0.5, p[1] - 0.5];
    out.push(L(p, [0.5 + d[0] * 3, 0.5 + d[1] * 3]));
  }
  if (ring) out.push(circle(0.5, 0.5, size));
  return out;
}

/** Sekiz kollu yıldız ve haç (Kaşan çinisi): yıldızlar uçlarından birbirine değer, arada haç kalır. */
function yildizHacKasan(inner: number): Shape[] {
  const pts = range(16).map((i): Pt => polar([0.5, 0.5], i % 2 ? inner : 0.5, -90 + i * 22.5));
  return [L(...pts, pts[0])];
}

const angle = (def: number) => ({ label: 'Yıldız açısı', min: 0, max: 85, step: 0.5, def, unit: '°' });
const spread = (def: number) => ({ label: 'Kol aralığı', min: 0, max: 0.6, step: 0.01, def });

/** Döşemeden yıldız deseni tanımı. */
function girih(id: string, name: string, group: string, tilingName: TilingName, def: number, deltaDef = 0): PatternDef {
  const tiling = TILINGS[tilingName]();
  // Birimin içinde çok çokgen varsa küçük resimde tek birim yeter
  const inside = tiling.polys.filter((p) => { const [x, y] = centroid(p); return x >= 0 && x < tiling.w && y >= 0 && y < tiling.h; }).length;
  return {
    id, name, kind: 'bar', group, param: angle(def), param2: spread(deltaDef), aspect: tiling.w / tiling.h, seamless: true, thumbCols: inside > 6 ? 1 : 2,
    build: (k, k2) => girihShapes(tiling, k, k2),
  };
}

const SO = 'Selçuklu / Osmanlı';

export const GIRIH_PATTERNS: PatternDef[] = [
  girih('girih-sekiz', 'Selçuklu sekiz kollu yıldız', SO, 'sekizgen', 67.5),
  girih('girih-sekiz-kesik', 'Kesik uçlu sekiz kollu yıldız', SO, 'sekizgen', 67.5, 0.35),
  girih('girih-sekiz-genis', 'Sekiz kollu yıldız ve haç', SO, 'sekizgen', 45),
  girih('girih-oniki', 'On iki kollu yıldız', SO, 'onikigen', 72),
  girih('girih-oniki-ince', 'İnce on iki kollu yıldız', SO, 'onikigen', 80),
  girih('girih-oniki-kesik', 'Kesik uçlu on iki yıldız', SO, 'onikigen', 72, 0.35),
  girih('girih-gul', 'On iki kollu gül', SO, 'gul', 60),
  girih('girih-gul-rozet', 'On iki kollu rozet', SO, 'gul', 72),
  girih('girih-gul-kesik', 'Çift kollu on iki gül', SO, 'gul', 60, 0.35),
  girih('girih-alti', 'Osmanlı altı kollu yıldız', SO, 'altigen', 60),
  girih('girih-alti-ince', 'İnce altı kollu yıldız', SO, 'altigen', 72),
  girih('girih-alti-kesik', 'Çift kollu altı yıldız', SO, 'altigen', 60, 0.4),
  girih('girih-kagome', 'Altı kollu yıldız ağı', SO, 'kagome', 60),
  girih('girih-yildiz-hac', 'Yıldız ve haç', SO, 'yildizHac', 60),
  girih('girih-kare', 'Dört kollu yıldız', SO, 'kare', 67.5),
  girih('girih-ucgen', 'Üçgen yıldız', SO, 'ucgen', 40),
  girih('girih-kivrik', 'Kıvrık kare yıldızı', SO, 'kivrikKare', 67.5),
  girih('girih-kivrik-kesik', 'Kıvrık kare çiçeği', SO, 'kivrikKare', 67.5, 0.3),
  girih('girih-uzun', 'Kuşak yıldızı', SO, 'uzunUcgen', 72),
  girih('girih-kahire', 'Kahire yıldızı', SO, 'kahire', 67.5),
  girih('girih-kahire-kesik', 'Çift kollu Kahire', SO, 'kahire', 67.5, 0.3),
  girih('girih-dortlu', 'Sekiz kollu gül', SO, 'dortlu', 30),
  girih('girih-uclu', 'On iki kollu çark', SO, 'ucluUcgen', 30),
  girih('girih-kisrombil', 'On iki kollu çiçek', SO, 'kisrombil', 25),
  girih('girih-kisrombil-kesik', 'Selçuklu çiçek rozeti', SO, 'kisrombil', 25, 0.4),
  girih('girih-rombil', 'Altı kollu çark', SO, 'rombil', 75),
  girih('girih-ucurtma', 'Uçurtma yıldızı', SO, 'ucurtma', 67.5),
  girih('girih-prizma', 'Beşgen kuşak', SO, 'prizma', 72),
  {
    id: 'madalyon', name: 'Yıldız madalyonu', kind: 'bar', group: 'Madalyon / göbek',
    param: { label: 'Kol sayısı', min: 5, max: 16, step: 1, def: 8 },
    param2: { label: 'Sivrilik', min: 1, max: 7, step: 1, def: 3, unit: '' },
    build: (n, k) => madalyon(n, k, false),
  },
  {
    id: 'madalyon-halka', name: 'Halkalı yıldız madalyonu', kind: 'bar', group: 'Madalyon / göbek',
    param: { label: 'Kol sayısı', min: 5, max: 16, step: 1, def: 12 },
    param2: { label: 'Sivrilik', min: 1, max: 7, step: 1, def: 5, unit: '' },
    build: (n, k) => madalyon(n, k, true),
  },
  {
    id: 'kasan', name: 'Kaşan yıldız ve haç', kind: 'bar', group: SO, seamless: true,
    param: { label: 'Yıldız iç çapı', min: 0.2, max: 0.45, step: 0.01, def: 0.33 },
    build: (k) => yildizHacKasan(k),
  },
  girih('roma-sekizgen', 'Sekizgen ve kare', 'Roma / Yunan', 'sekizgen', 0),
  girih('roma-kahire', 'Kahire döşemesi', 'Roma / Yunan', 'kahire', 0),
  girih('klasik-onikigen', 'On ikigen ağ', 'Klasik', 'onikigen', 0),
  girih('klasik-altigen-kare', 'Altıgen ve kare', 'Klasik', 'yildizHac', 0),
  girih('girih-petek-halka', 'Petek halka', 'Klasik', 'ucgen', 72),
  girih('klasik-kup', 'Küp kutusu', 'Klasik', 'rombil', 0),
  girih('petek', 'Petek', 'Modern', 'altigen', 0),
  girih('ucgen-ag', 'Üçgen ağ', 'Modern', 'ucgen', 0),
  girih('kagome', 'Kagome örgü', 'Modern', 'kagome', 0),
  {
    id: 'asanoha', name: 'Kenevir yaprağı', kind: 'bar', group: 'Modern', aspect: 1 / S3, seamless: true,
    build: () => asanoha(),
  },
];
