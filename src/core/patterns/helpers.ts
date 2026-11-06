import type { Pt } from './shapes';

export const range = (n: number) => Array.from({ length: Math.max(0, Math.floor(n)) }, (_, i) => i);

/** Çember yayı noktaları (açılar radyan; y aşağı doğru, açı saat yönünde artar). */
export function arcPts(cx: number, cy: number, r: number, a0: number, a1: number, n = Math.max(8, Math.ceil(Math.abs(a1 - a0) * 16))): Pt[] {
  return range(n + 1).map((i): Pt => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
}

/**
 * Sarmal (ferforje kıvrımı): (cx, cy) çevresinde a0 açısından başlar, turns tur döner,
 * yarıçap r0'dan r1'e iner. dir 1 saat yönü, -1 tersi.
 */
export function spiralPts(cx: number, cy: number, r0: number, r1: number, a0: number, turns: number, dir: 1 | -1): Pt[] {
  const n = Math.ceil(turns * 48);
  return range(n + 1).map((i): Pt => {
    const t = i / n;
    const a = a0 + dir * t * turns * 2 * Math.PI;
    const r = r0 + (r1 - r0) * t;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
}

/** Kübik Bézier eğrisi noktaları. */
export function cubicPts(p0: Pt, p1: Pt, p2: Pt, p3: Pt, n = 16): Pt[] {
  return range(n + 1).map((i): Pt => {
    const t = i / n;
    const u = 1 - t;
    const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]];
  });
}

/** Düzgün çokgenin köşeleri: merkez, kenar sayısı, çevrel yarıçap, ilk köşenin açısı. */
export function regularPts(c: Pt, n: number, R: number, a0: number): Pt[] {
  return range(n).map((i): Pt => [c[0] + R * Math.cos(a0 + (2 * Math.PI * i) / n), c[1] + R * Math.sin(a0 + (2 * Math.PI * i) / n)]);
}

/** Tohumlu sözde rastgele sayı (aynı tohum hep aynı deseni verir). */
export function seededRandom(seed: number): () => number {
  let a = (Math.floor(seed) * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Desen biriminin gerçek ölçüsündeki (w × h) noktaları birim karoya (0..1) çevirir. */
export const unit = (pts: Pt[], w: number, h: number): Pt[] => pts.map(([x, y]) => [x / w, y / h]);
