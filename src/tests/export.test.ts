import { describe, expect, it } from 'vitest';
import { DEFAULT_DESIGN } from '../core/design';
import { buildPanel } from '../core/engine';
import { toDxf } from '../core/export/dxf';
import { pathData, toSvg } from '../core/export/svg';

const result = buildPanel({ ...DEFAULT_DESIGN, width: 200, height: 300, frameSide: 20, frameTopBottom: 20, cols: 1, rows: 1, squareTiles: false, patternId: 'arti', bar: 10, minGap: 0 });

/** DXF'i (kod, değer) çiftlerine ayırır. */
function pairs(dxf: string): [string, string][] {
  const lines = dxf.split('\r\n');
  const out: [string, string][] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) out.push([lines[i], lines[i + 1]]);
  return out;
}

describe('DXF', () => {
  const dxf = toDxf(result);
  const p = pairs(dxf);

  it('her kontur kapalı bir POLYLINE, doğru katmanda', () => {
    const polylines = p.filter(([c, v]) => c === '0' && v === 'POLYLINE');
    expect(polylines).toHaveLength(result.contours.length);
    expect(dxf).toContain('IC_KONTUR');
    expect(dxf).toContain('DIS_KONTUR');
    expect(dxf.trimEnd().endsWith('EOF')).toBe(true);
    // Kapalı bayrağı (70 = 1) her POLYLINE'da
    const idx = p.findIndex(([c, v]) => c === '0' && v === 'POLYLINE');
    expect(p.slice(idx, idx + 6)).toContainEqual(['70', '1']);
  });

  it('y ekseni yukarı: panel 0..en, 0..boy aralığında', () => {
    const xs = p.filter(([c]) => c === '10').map(([, v]) => Number(v));
    const ys = p.filter(([c]) => c === '20').map(([, v]) => Number(v));
    expect(Math.min(...xs)).toBe(0);
    expect(Math.max(...xs)).toBe(200);
    expect(Math.min(...ys)).toBe(0);
    expect(Math.max(...ys)).toBe(300);
    // Çizimde üstte (küçük y) olan boşluk DXF'te üst yarıda (büyük y) olmalı
    const top = toDxf({ ...result, contours: result.contours.filter((c) => c.kind === 'hole' && c.pts.every(([, y]) => y < 150)).slice(0, 1) });
    const topYs = pairs(top).filter(([c]) => c === '20').map(([, v]) => Number(v)).filter((y) => y > 0);
    expect(Math.min(...topYs)).toBeGreaterThan(150);
  });

  it('dış kenar en son kesilir', () => {
    const lastPoly = dxf.lastIndexOf('POLYLINE');
    expect(dxf.slice(lastPoly, lastPoly + 40)).toContain('DIS_KONTUR');
  });
});

describe('SVG', () => {
  it('gerçek ölçüde (mm) ve kesim türüne göre yollar', () => {
    const svg = toSvg(result, 'cut');
    expect(svg).toContain('width="200mm"');
    expect(svg).toContain('height="300mm"');
    expect(svg).toContain('id="outer"');
    expect(svg).toContain('id="hole"');
    expect(svg).not.toContain('id="island"');
    expect(toSvg(result, 'filled')).toContain('fill-rule="evenodd"');
  });

  it('yol verisi her kontur için kapalı', () => {
    const d = pathData(result.contours);
    expect(d.match(/M/g)).toHaveLength(result.contours.length);
    expect(d.match(/Z/g)).toHaveLength(result.contours.length);
  });
});
