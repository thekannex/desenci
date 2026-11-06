import type { Design } from './design';

export interface Rect { x: number; y: number; w: number; h: number }

export interface Tile extends Rect {
  col: number;
  row: number;
}

export interface Layout {
  /** Çerçevenin içi (karoların ve aralarındaki şeritlerin bulunduğu alan) */
  inner: Rect;
  cols: number;
  rows: number;
  tileW: number;
  tileH: number;
  tiles: Tile[];
  /** Karo sığmıyorsa açıklama (o zaman tiles boş) */
  error?: string;
}

/** En küçük karo kenarı (mm); daha küçüğü kesilemez. */
export const MIN_TILE = 5;

/** Verilen sütun sayısına göre karo oranı (eni / boyu) aspect'e en yakın sıra sayısı. */
export function squareRows(innerW: number, innerH: number, cols: number, divider: number, aspect = 1): number {
  const tileW = (innerW - (cols - 1) * divider) / cols;
  if (tileW <= 0) return 1;
  return Math.max(1, Math.round((innerH + divider) / (tileW / aspect + divider)));
}

/** Karoların panel içindeki yerleri (aspect: desenin istediği karo eni / boyu). */
export function computeLayout(d: Design, aspect = 1): Layout {
  const inner: Rect = { x: d.frameSide, y: d.frameTopBottom, w: d.width - 2 * d.frameSide, h: d.height - 2 * d.frameTopBottom };
  const cols = Math.max(1, Math.round(d.cols));
  const rows = d.squareTiles ? squareRows(inner.w, inner.h, cols, d.divider, aspect) : Math.max(1, Math.round(d.rows));
  const tileW = (inner.w - (cols - 1) * d.divider) / cols;
  const tileH = (inner.h - (rows - 1) * d.divider) / rows;
  const base = { inner, cols, rows, tileW, tileH, tiles: [] as Tile[] };
  if (inner.w <= 0 || inner.h <= 0) return { ...base, error: 'Çerçeve paneli tamamen kaplıyor; çerçeveyi daraltın.' };
  if (tileW < MIN_TILE || tileH < MIN_TILE) return { ...base, error: 'Karolar çok küçük; karo sayısını ya da karo arasını azaltın.' };
  const tiles: Tile[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      tiles.push({ col, row, x: inner.x + col * (tileW + d.divider), y: inner.y + row * (tileH + d.divider), w: tileW, h: tileH });
    }
  }
  return { ...base, tiles };
}
