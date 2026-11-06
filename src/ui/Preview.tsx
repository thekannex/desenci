import { useMemo, useRef, useState } from 'react';
import { Maximize, Minus, Plus } from 'lucide-react';
import type { Contour, PanelResult } from '../core/engine';
import { BEND_COLORS, CUT_COLORS, pathData } from '../core/export/svg';
import { useZoomPan } from './use-zoom-pan';
import { Button, Segmented } from './ui';
import { fmt } from './format';

type Mode = 'filled' | 'cut';

/** Ölçü çizgisi: (x1,y1)–(x2,y2) arası, yazı ortada. */
function Dim({ x1, y1, x2, y2, text, fs, vertical }: { x1: number; y1: number; x2: number; y2: number; text: string; fs: number; vertical?: boolean }) {
  const t = fs * 0.4;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  return (
    <g stroke="#71717a" fill="#52525b" strokeWidth={fs * 0.06}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      {vertical ? (
        <>
          <line x1={x1 - t} y1={y1} x2={x1 + t} y2={y1} />
          <line x1={x2 - t} y1={y2} x2={x2 + t} y2={y2} />
          <text x={mx - fs * 0.45} y={my} fontSize={fs} stroke="none" textAnchor="middle" transform={`rotate(-90 ${mx - fs * 0.45} ${my})`}>{text}</text>
        </>
      ) : (
        <>
          <line x1={x1} y1={y1 - t} x2={x1} y2={y1 + t} />
          <line x1={x2} y1={y2 - t} x2={x2} y2={y2 + t} />
          <text x={mx} y={my - fs * 0.45} fontSize={fs} stroke="none" textAnchor="middle">{text}</text>
        </>
      )}
    </g>
  );
}

export default function Preview({ result, busy }: { result: PanelResult; busy: boolean }) {
  const { width: W } = result.design;
  const [mode, setMode] = useState<Mode>('filled');
  const svgRef = useRef<SVGSVGElement>(null);
  const b = result.bounds;
  const size = Math.max(b.maxX - b.minX, b.maxY - b.minY);
  const m = size * 0.09;
  const fs = size * 0.022;
  const base = useMemo(() => ({ x: b.minX - m, y: b.minY - m, w: b.maxX - b.minX + 2 * m, h: b.maxY - b.minY + 2 * m }), [b.minX, b.minY, b.maxX, b.maxY, m]);
  const { svgProps, zoom, zoomIn, zoomOut, fit } = useZoomPan(base, svgRef);

  const paths = useMemo(() => {
    const by = (k: Contour['kind']) => pathData(result.contours.filter((c) => c.kind === k));
    return {
      all: pathData(result.contours), outer: by('outer'), hole: by('hole'), island: by('island'), mount: by('mount'), slot: by('slot'), part: by('part'),
    };
  }, [result]);

  const { layout } = result;
  const firstTile = layout.tiles[0];
  // Panelin (açınım) sınırları: ölçü çizgileri bunun dışına
  const outer = result.contours.find((c) => c.kind === 'outer')?.pts ?? [];
  const oy0 = Math.min(...outer.map((p) => p[1]));
  const oy1 = Math.max(...outer.map((p) => p[1]));
  const ox0 = Math.min(...outer.map((p) => p[0]));
  const ox1 = Math.max(...outer.map((p) => p[0]));
  const flatDiffers = Math.abs(ox1 - ox0 - W) > 0.05;
  const parts = result.contours.filter((c) => c.kind === 'part');
  const legend: [string, string][] = [
    [CUT_COLORS.outer, 'Dış kenar'], [CUT_COLORS.hole, 'Boşluk'],
    ...(paths.mount ? [[CUT_COLORS.mount, 'Delik'] as [string, string]] : []),
    ...(paths.slot ? [[CUT_COLORS.slot, 'Geçme yuvası'] as [string, string]] : []),
    ...(paths.part ? [[CUT_COLORS.part, 'Şerit'] as [string, string]] : []),
    ...(paths.island ? [[CUT_COLORS.island, 'Düşen parça'] as [string, string]] : []),
  ];

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2">
        <div className="w-56">
          <Segmented ariaLabel="Görünüm" value={mode} onChange={setMode}
            options={[{ value: 'filled', label: 'Sac görünümü' }, { value: 'cut', label: 'Kesim çizgileri' }]} />
        </div>
        {mode === 'cut' && (
          <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--color-text-muted)]">
            {legend.map(([c, l]) => <span key={l} className="flex items-center gap-1"><i className="inline-block h-0.5 w-4" style={{ background: c }} />{l}</span>)}
            {result.bends.length > 0 && <span className="flex items-center gap-1"><i className="inline-block h-0 w-4 border-t-2 border-dashed" style={{ borderColor: BEND_COLORS.arka }} />Büküm çizgisi</span>}
          </div>
        )}
        <div className="ml-auto flex items-center gap-1">
          {busy && <span className="mr-2 text-xs text-[var(--color-text-dim)]">hesaplanıyor…</span>}
          <Button variant="ghost" title="Uzaklaştır" onClick={zoomOut}><Minus size={15} /></Button>
          <span className="w-12 text-center text-xs tabular-nums text-[var(--color-text-muted)]">%{zoom}</span>
          <Button variant="ghost" title="Yakınlaştır" onClick={zoomIn}><Plus size={15} /></Button>
          <Button variant="ghost" title="Sığdır" onClick={fit}><Maximize size={15} /></Button>
        </div>
      </div>
      <div className="relative min-h-0 flex-1 bg-[repeating-conic-gradient(#f4f4f5_0_25%,#fafafa_0_50%)] bg-[length:24px_24px]">
        <svg ref={svgRef} {...svgProps} className="absolute inset-0 h-full w-full touch-none" preserveAspectRatio="xMidYMid meet" data-testid="preview">
          {mode === 'filled' ? (
            <>
              <path d={paths.all} fill="#3f3f46" fillRule="evenodd" />
              {paths.island && <path d={paths.island} fill="#dc2626" fillRule="evenodd" />}
            </>
          ) : (
            <>
              <rect x={b.minX} y={b.minY} width={b.maxX - b.minX} height={b.maxY - b.minY} fill="#ffffff" />
              {(['outer', 'hole', 'mount', 'slot', 'part', 'island'] as const).map((k) => paths[k] && (
                <path key={k} d={paths[k]} fill="none" stroke={CUT_COLORS[k]} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
              ))}
            </>
          )}
          {result.bends.map((bd, i) => {
            const vertical = Math.abs(bd.a[0] - bd.b[0]) < 1e-6;
            const mx = (bd.a[0] + bd.b[0]) / 2;
            const my = (bd.a[1] + bd.b[1]) / 2;
            const text = bd.kind === 'arka' ? 'arkaya 90°' : 'öne 90°';
            return (
              <g key={i}>
                <line x1={bd.a[0]} y1={bd.a[1]} x2={bd.b[0]} y2={bd.b[1]} stroke={BEND_COLORS[bd.kind]} strokeWidth={1.5} strokeDasharray="8 5" vectorEffect="non-scaling-stroke" />
                <text x={mx} y={my - fs * 0.35} fontSize={fs * 0.6} fill={BEND_COLORS[bd.kind]} textAnchor="middle" transform={vertical ? `rotate(-90 ${mx} ${my})` : undefined}>{text}</text>
              </g>
            );
          })}
          {parts.map((p) => {
            const xs = p.pts.map((q) => q[0]);
            const ys = p.pts.map((q) => q[1]);
            const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
            const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
            return (
              <text key={p.label} x={cx} y={cy} fontSize={Math.min(fs * 0.7, (Math.max(...ys) - Math.min(...ys)) * 0.6)} dominantBaseline="middle" textAnchor="middle"
                fill={mode === 'filled' ? '#fafafa' : CUT_COLORS.part}>{p.label} · {fmt(Math.max(...xs) - Math.min(...xs))} mm</text>
            );
          })}
          <Dim x1={0} y1={oy0 - m * 0.45} x2={W} y2={oy0 - m * 0.45} text={`${fmt(W)} mm${flatDiffers ? ` (açınım ${fmt(ox1 - ox0)})` : ''}`} fs={fs} />
          <Dim x1={ox0 - m * 0.45} y1={0} x2={ox0 - m * 0.45} y2={result.design.height} text={`${fmt(result.design.height)} mm${Math.abs(oy1 - oy0 - result.design.height) > 0.05 ? ` (açınım ${fmt(oy1 - oy0)})` : ''}`} fs={fs} vertical />
          {firstTile && !parts.length && (
            <Dim x1={firstTile.x} y1={oy1 + m * 0.4} x2={firstTile.x + firstTile.w} y2={oy1 + m * 0.4} text={`karo ${fmt(firstTile.w)}`} fs={fs * 0.8} />
          )}
        </svg>
        <p className="pointer-events-none absolute bottom-2 left-3 text-[11px] text-[var(--color-text-dim)]">Tekerlek: yakınlaştır · Orta tuş ya da Boşluk + sürükle: kaydır</p>
      </div>
    </div>
  );
}
