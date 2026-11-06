/** Birim karo koordinatı: (0,0) sol üst, (1,1) sağ alt. */
export type Pt = [number, number];

/**
 * Desen öğeleri (birim karo koordinatında).
 * Çubuk desenlerinde çizgiler ve dolgular METAL, kalan yer boşluktur.
 * Yarık desenlerinde karo dolu sacdır; çizgiler ve dolgular BOŞLUK (kesilip atılan yer) olur.
 */
export type Shape =
  | { t: 'line'; pts: Pt[]; closed?: boolean }
  | { t: 'circle'; c: Pt; r: number }
  | { t: 'poly'; pts: Pt[] }
  | { t: 'disc'; c: Pt; r: number };

/** Açık çizgi (iki ya da daha çok nokta). */
export const L = (...pts: Pt[]): Shape => ({ t: 'line', pts });
/** Kapalı çizgi (kenarları çubuk / yarık olan çokgen). */
export const ring = (...pts: Pt[]): Shape => ({ t: 'line', pts, closed: true });
/** Dikdörtgen çerçeve çizgisi. */
export const rect = (x: number, y: number, w: number, h: number): Shape => ring([x, y], [x + w, y], [x + w, y + h], [x, y + h]);
/** Ortası (cx, cy) olan kare çerçeve çizgisi. */
export const square = (cx: number, cy: number, size: number): Shape => rect(cx - size / 2, cy - size / 2, size, size);
/** Ortası (cx, cy) olan baklava (45° dönük kare); r merkezden köşeye uzaklık. */
export const diamond = (cx: number, cy: number, r: number): Shape => ring([cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy]);
export const circle = (cx: number, cy: number, r: number): Shape => ({ t: 'circle', c: [cx, cy], r });
/** Dolu çokgen. */
export const poly = (...pts: Pt[]): Shape => ({ t: 'poly', pts });
/** Dolu dikdörtgen. */
export const box = (x: number, y: number, w: number, h: number): Shape => poly([x, y], [x + w, y], [x + w, y + h], [x, y + h]);
export const disc = (cx: number, cy: number, r: number): Shape => ({ t: 'disc', c: [cx, cy], r });

/** Noktayı karo ortası çevresinde 90° × n döndürür. */
export function rotPt([x, y]: Pt, n: number): Pt {
  let p: Pt = [x, y];
  for (let i = 0; i < ((n % 4) + 4) % 4; i++) p = [1 - p[1], p[0]];
  return p;
}

export function mapShape(s: Shape, f: (p: Pt) => Pt): Shape {
  switch (s.t) {
    case 'line': return { ...s, pts: s.pts.map(f) };
    case 'poly': return { ...s, pts: s.pts.map(f) };
    // Daire / disk merkezi taşınır; yarıçap dönme ve aynalamada değişmez
    case 'circle': return { ...s, c: f(s.c) };
    case 'disc': return { ...s, c: f(s.c) };
  }
}

/** Öğeleri karo ortası çevresinde dört kez (0°, 90°, 180°, 270°) çoğaltır. */
export const sym4 = (...shapes: Shape[]): Shape[] => [0, 1, 2, 3].flatMap((n) => shapes.map((s) => mapShape(s, (p) => rotPt(p, n))));
