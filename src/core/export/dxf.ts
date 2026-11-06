import type { Contour, PanelResult } from '../engine';

/** DXF katmanları: CAM programında dış kenar, iç kesimler ve işaretler ayrı seçilebilsin. */
export const DXF_LAYERS: Record<Contour['kind'], { name: string; color: number }> = {
  outer: { name: 'DIS_KONTUR', color: 1 },
  hole: { name: 'IC_KONTUR', color: 5 },
  island: { name: 'DUSEN_PARCA', color: 6 },
  mount: { name: 'BAGLANTI_DELIGI', color: 3 },
  slot: { name: 'GECME_YUVASI', color: 4 },
  part: { name: 'PARCA', color: 30 },
};
/** Büküm çizgileri: kesilmez, abkant için işaret (arkaya / öne ayrı katman). */
export const BEND_LAYERS = { arka: { name: 'BUKUM_ARKAYA', color: 2 }, on: { name: 'BUKUM_ONE', color: 7 } };

const n = (v: number) => (Math.round(v * 1000) / 1000).toString();

/**
 * Kesim konturlarını DXF (R12, mm) olarak yazar. Her kontur kapalı bir POLYLINE'dır, büküm çizgileri LINE.
 * DXF'te y yukarı doğrudur; çizim çevrilir ve bütün çizimin sol alt köşesi 0,0 olur.
 */
export function toDxf(r: PanelResult): string {
  const { minX, maxY, maxX, minY } = r.bounds;
  const X = (x: number) => n(x - minX);
  const Y = (y: number) => n(maxY - y);
  const out: string[] = [];
  const g = (code: number, value: string | number) => out.push(String(code), String(value));
  const layers = [...Object.values(DXF_LAYERS), ...Object.values(BEND_LAYERS)];

  g(0, 'SECTION'); g(2, 'HEADER');
  g(9, '$ACADVER'); g(1, 'AC1009');
  g(9, '$INSUNITS'); g(70, 4);
  g(9, '$EXTMIN'); g(10, 0); g(20, 0); g(30, 0);
  g(9, '$EXTMAX'); g(10, n(maxX - minX)); g(20, n(maxY - minY)); g(30, 0);
  g(0, 'ENDSEC');

  g(0, 'SECTION'); g(2, 'TABLES');
  g(0, 'TABLE'); g(2, 'LAYER'); g(70, layers.length);
  for (const l of layers) {
    g(0, 'LAYER'); g(2, l.name); g(70, 0); g(62, l.color); g(6, 'CONTINUOUS');
  }
  g(0, 'ENDTAB');
  g(0, 'ENDSEC');

  g(0, 'SECTION'); g(2, 'ENTITIES');
  for (const c of r.contours) {
    const layer = DXF_LAYERS[c.kind].name;
    g(0, 'POLYLINE'); g(8, layer); g(66, 1); g(70, 1); g(10, 0); g(20, 0); g(30, 0);
    for (const [x, y] of c.pts) {
      g(0, 'VERTEX'); g(8, layer); g(10, X(x)); g(20, Y(y)); g(30, 0);
    }
    g(0, 'SEQEND'); g(8, layer);
  }
  for (const b of r.bends) {
    g(0, 'LINE'); g(8, BEND_LAYERS[b.kind].name);
    g(10, X(b.a[0])); g(20, Y(b.a[1])); g(30, 0);
    g(11, X(b.b[0])); g(21, Y(b.b[1])); g(31, 0);
  }
  g(0, 'ENDSEC');
  g(0, 'EOF');
  return out.join('\r\n') + '\r\n';
}
