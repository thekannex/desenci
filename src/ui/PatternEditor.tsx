import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { CircleDot, Eraser, PenLine, Pentagon, Trash2, Undo2, X } from 'lucide-react';
import { DEFAULT_DESIGN } from '../core/design';
import { buildPanel } from '../core/engine';
import { pathData } from '../core/export/svg';
import { SYMMETRY_LABELS, applySymmetry, forKind } from '../core/patterns/custom';
import type { CustomPattern, Symmetry } from '../core/patterns/custom';
import type { Pt, Shape } from '../core/patterns/shapes';
import { Button, NumInput, Segmented } from './ui';

type Tool = 'cizgi' | 'dolu' | 'daire' | 'sil';

const TOOLS: { id: Tool; label: string; icon: typeof PenLine; hint: string }[] = [
  { id: 'cizgi', label: 'Çizgi', icon: PenLine, hint: 'Noktalara tıklayın. Bitirmek için son noktaya yeniden tıklayın ya da Enter; ilk noktaya tıklarsanız şekil kapanır.' },
  { id: 'dolu', label: 'Dolu şekil', icon: Pentagon, hint: 'Köşelere tıklayın, ilk noktaya tıklayarak kapatın. Çubuk deseninde metal dolgu, yarık deseninde kesilip atılan boşluk olur.' },
  { id: 'daire', label: 'Daire', icon: CircleDot, hint: 'Önce merkeze, sonra çemberin geçeceği yere tıklayın.' },
  { id: 'sil', label: 'Sil', icon: Eraser, hint: 'Silmek istediğiniz çizgiye tıklayın.' },
];

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Noktanın doğru parçasına uzaklığı. */
function segDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
  return dist(p, [a[0] + t * dx, a[1] + t * dy]);
}

function shapeDist(p: Pt, s: Shape): number {
  if (s.t === 'circle' || s.t === 'disc') return Math.abs(dist(p, s.c) - s.r);
  const pts = s.pts;
  const closed = s.t === 'poly' || s.closed;
  let d = Infinity;
  for (let i = 0; i < pts.length - (closed ? 0 : 1); i++) d = Math.min(d, segDist(p, pts[i], pts[(i + 1) % pts.length]));
  return d;
}

function ShapeView({ s, kind, faint }: { s: Shape; kind: 'bar' | 'slot'; faint?: boolean }) {
  const stroke = kind === 'bar' ? '#27272a' : '#c2410c';
  const fill = kind === 'bar' ? '#52525b' : '#fdba74';
  const common = { stroke, strokeWidth: 3, vectorEffect: 'non-scaling-stroke' as const, opacity: faint ? 0.3 : 1, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  const pts = (p: Pt[]) => p.map((q) => q.join(',')).join(' ');
  switch (s.t) {
    case 'line': return s.closed ? <polygon points={pts(s.pts)} fill="none" {...common} /> : <polyline points={pts(s.pts)} fill="none" {...common} />;
    case 'poly': return <polygon points={pts(s.pts)} fill={fill} {...common} />;
    case 'circle': return <circle cx={s.c[0]} cy={s.c[1]} r={s.r} fill="none" {...common} />;
    case 'disc': return <circle cx={s.c[0]} cy={s.c[1]} r={s.r} fill={fill} {...common} />;
  }
}

/** Kendi desenini çizme / düzenleme penceresi. */
export default function PatternEditor({ initial, isNew, onSave, onDelete, onClose }: {
  initial: CustomPattern;
  isNew: boolean;
  onSave: (p: CustomPattern) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [kind, setKind] = useState(initial.kind);
  const [symmetry, setSymmetry] = useState<Symmetry>(initial.symmetry);
  const [aspect, setAspect] = useState(initial.aspect);
  const [shapes, setShapes] = useState<Shape[]>(initial.shapes);
  const [history, setHistory] = useState<Shape[][]>([]);
  const [tool, setTool] = useState<Tool>('cizgi');
  const [grid, setGrid] = useState(12);
  const [snap, setSnap] = useState(true);
  const [draft, setDraft] = useState<Pt[]>([]);
  const [hover, setHover] = useState<Pt | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Ana sayfanın Ctrl+Z'si bu pencere açıkken çalışmasın
  useEffect(() => {
    document.body.dataset.modal = '1';
    return () => { delete document.body.dataset.modal; };
  }, []);

  const commit = (next: Shape[]) => {
    setHistory((h) => [...h.slice(-80), shapes]);
    setShapes(next);
  };
  const undo = () => {
    if (draft.length) { setDraft(draft.slice(0, -1)); return; }
    if (!history.length) return;
    setShapes(history[history.length - 1]);
    setHistory(history.slice(0, -1));
  };

  const finish = (closed: boolean) => {
    if (tool === 'cizgi' && draft.length >= 2) commit([...shapes, { t: 'line', pts: draft, closed: closed && draft.length >= 3 }]);
    if (tool === 'dolu' && draft.length >= 3) commit([...shapes, { t: 'poly', pts: draft }]);
    setDraft([]);
  };

  // Klavye: Enter bitirir, Esc vazgeçer, Ctrl+Z geri alır
  const keyRef = useRef({ finish, undo, draft });
  useEffect(() => { keyRef.current = { finish, undo, draft }; });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'Enter') { e.preventDefault(); keyRef.current.finish(false); }
      else if (e.key === 'Escape') { e.preventDefault(); setDraft([]); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); keyRef.current.undo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toUnit = (e: ReactPointerEvent): Pt | null => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(ctm.inverse());
    let x = p.x, y = p.y;
    if (snap) { x = Math.round(x * grid) / grid; y = Math.round(y * grid) / grid; }
    return [Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y))];
  };

  const near = 0.5 / Math.max(grid, 8);
  const onClick = (e: ReactPointerEvent) => {
    if (e.button === 2) { finish(false); return; }
    const p = toUnit(e);
    if (!p) return;
    if (tool === 'sil') {
      let best = -1, bd = 0.03;
      shapes.forEach((s, i) => { const d = shapeDist(p, s); if (d < bd) { bd = d; best = i; } });
      if (best >= 0) commit(shapes.filter((_, i) => i !== best));
      return;
    }
    if (tool === 'daire') {
      if (!draft.length) { setDraft([p]); return; }
      const r = dist(draft[0], p);
      if (r > 0.005) commit([...shapes, { t: 'circle', c: draft[0], r }]);
      setDraft([]);
      return;
    }
    if (draft.length >= 3 && dist(p, draft[0]) < near) { finish(true); return; }
    if (draft.length && dist(p, draft[draft.length - 1]) < near / 2) { finish(false); return; }
    setDraft([...draft, p]);
  };

  const result: CustomPattern = { id: initial.id, name: name.trim() || 'Desenim', kind, aspect, symmetry, shapes: forKind(shapes, kind) };
  const shown = forKind(shapes, kind);
  const copies = applySymmetry(shown, symmetry).slice(shown.length);

  // Sağda 3 × 3 karo ön izleme
  const preview = useMemo(() => {
    const w = 300;
    const h = Math.min(600, Math.max(100, w / aspect));
    return buildPanel({
      ...DEFAULT_DESIGN, width: w, height: h, frameSide: 6, frameTopBottom: 6, cols: 3, squareTiles: true, divider: 4,
      bar: 4, slot: 4, minGap: 1.5, patternId: result.id, custom: result,
    });
    // result her çizimde yeniden kurulur; içeriği değişince hesaplansın
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapes, kind, symmetry, aspect]);

  const activeTool = TOOLS.find((t) => t.id === tool)!;
  const lines = Array.from({ length: grid + 1 }, (_, i) => i / grid);
  const pts = (p: Pt[]) => p.map((q) => q.join(',')).join(' ');

  return (
    <div role="dialog" aria-modal="true" aria-label="Desen çizimi" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2 sm:p-6">
      <div className="flex h-full max-h-[900px] w-full max-w-[1200px] flex-col overflow-hidden rounded-xl bg-[var(--color-bg-card)] shadow-2xl">
        <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-4 py-2">
          <h2 className="text-sm font-bold">{isNew ? 'Yeni desen' : 'Deseni düzenle'}</h2>
          <input aria-label="Desen adı" value={name} onChange={(e) => setName(e.target.value)} maxLength={60}
            className="h-8 w-56 rounded-md border border-[var(--color-border)] px-2 text-sm focus:border-[var(--color-border-focus)]" />
          <div className="ml-auto flex items-center gap-1.5">
            {onDelete && <Button title="Deseni sil" onClick={() => { if (confirm(`"${name}" deseni silinsin mi?`)) onDelete(); }}><Trash2 size={15} /> Sil</Button>}
            <Button variant="primary" disabled={!shapes.length} onClick={() => onSave(result)}>Kaydet ve seç</Button>
            <Button variant="ghost" title="Kapat" onClick={() => { if (shapes === initial.shapes || confirm('Kaydetmeden çıkılsın mı?')) onClose(); }}><X size={16} /></Button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* Araçlar */}
          <div className="flex shrink-0 flex-row flex-wrap gap-1 border-b border-[var(--color-border)] p-2 lg:w-36 lg:flex-col lg:border-r lg:border-b-0">
            {TOOLS.map((t) => (
              <button key={t.id} type="button" onClick={() => { setTool(t.id); setDraft([]); }} aria-pressed={tool === t.id}
                className={`flex h-9 items-center gap-2 rounded-md px-2 text-sm ${tool === t.id ? 'bg-[var(--color-accent)] text-white' : 'hover:bg-[var(--color-bg-hover)]'}`}>
                <t.icon size={16} /> {t.label}
              </button>
            ))}
            <div className="my-1 hidden h-px bg-[var(--color-border)] lg:block" />
            <Button variant="ghost" title="Geri al (Ctrl+Z)" disabled={!history.length && !draft.length} onClick={undo} className="justify-start"><Undo2 size={15} /> Geri al</Button>
            <Button variant="ghost" title="Hepsini temizle" disabled={!shapes.length} onClick={() => { if (confirm('Çizimin hepsi silinsin mi?')) commit([]); }} className="justify-start"><Trash2 size={15} /> Temizle</Button>
          </div>

          {/* Çizim alanı */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-2 bg-[var(--color-bg-input)] p-3">
            <p className="max-w-xl text-center text-xs text-[var(--color-text-muted)]">{activeTool.hint}</p>
            <div className="relative" style={{ aspectRatio: `${aspect}`, width: `min(100%, calc((100vh - 260px) * ${aspect}))` }}>
              <svg ref={svgRef} viewBox="-0.04 -0.04 1.08 1.08" preserveAspectRatio="none" className="absolute inset-0 h-full w-full cursor-crosshair touch-none select-none"
                onPointerDown={onClick} onPointerMove={(e) => setHover(toUnit(e))} onPointerLeave={() => setHover(null)} onContextMenu={(e) => e.preventDefault()}>
                <rect x={0} y={0} width={1} height={1} fill={kind === 'slot' ? '#3f3f46' : '#ffffff'} />
                {lines.map((v) => (
                  <g key={v} stroke={kind === 'slot' ? '#52525b' : '#e4e4e7'} strokeWidth={1} vectorEffect="non-scaling-stroke">
                    <line x1={v} y1={0} x2={v} y2={1} vectorEffect="non-scaling-stroke" />
                    <line x1={0} y1={v} x2={1} y2={v} vectorEffect="non-scaling-stroke" />
                  </g>
                ))}
                <g stroke="#a1a1aa" strokeDasharray="4 4" strokeWidth={1}>
                  <line x1={0.5} y1={0} x2={0.5} y2={1} vectorEffect="non-scaling-stroke" />
                  <line x1={0} y1={0.5} x2={1} y2={0.5} vectorEffect="non-scaling-stroke" />
                </g>
                {kind === 'bar' && <rect x={0} y={0} width={1} height={1} fill="none" stroke="#27272a" strokeWidth={6} vectorEffect="non-scaling-stroke" />}
                {copies.map((s, i) => <ShapeView key={`c${i}`} s={s} kind={kind} faint />)}
                {shown.map((s, i) => <ShapeView key={i} s={s} kind={kind} />)}
                {draft.length > 0 && tool !== 'daire' && (
                  <polyline points={pts(hover ? [...draft, hover] : draft)} fill="none" stroke="#2563eb" strokeWidth={2} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
                )}
                {tool === 'daire' && draft.length === 1 && hover && (
                  <circle cx={draft[0][0]} cy={draft[0][1]} r={dist(draft[0], hover)} fill="none" stroke="#2563eb" strokeWidth={2} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
                )}
                {draft.map((p, i) => <circle key={`d${i}`} cx={p[0]} cy={p[1]} r={0.007} fill="#2563eb" />)}
                {hover && <circle cx={hover[0]} cy={hover[1]} r={0.009} fill="none" stroke="#2563eb" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />}
              </svg>
            </div>
            <p className="text-[11px] text-[var(--color-text-dim)]">Koyu çizgiler sizin çiziminiz, soluk olanlar simetriyle gelen kopyalar. Karonun kenarına değen çizgiler çerçeveye bağlanır.</p>
          </div>

          {/* Ayarlar ve ön izleme */}
          <div className="flex shrink-0 flex-col gap-3 overflow-y-auto border-t border-[var(--color-border)] p-3 lg:w-72 lg:border-t-0 lg:border-l">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[var(--color-text-muted)]">Desen türü</span>
              <Segmented ariaLabel="Desen türü" value={kind} onChange={setKind}
                options={[{ value: 'bar', label: 'Çubuk (metal çizgi)' }, { value: 'slot', label: 'Yarık (kesik)' }]} />
            </div>
            <label className="flex flex-col gap-1 text-xs font-medium text-[var(--color-text-muted)]">
              Simetri
              <select value={symmetry} onChange={(e) => setSymmetry(e.target.value as Symmetry)}
                className="h-8 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] px-2 text-sm text-[var(--color-text)]">
                {(Object.keys(SYMMETRY_LABELS) as Symmetry[]).map((s) => <option key={s} value={s}>{SYMMETRY_LABELS[s]}</option>)}
              </select>
            </label>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[var(--color-text-muted)]">Karo oranı (en / boy)</span>
              <div className="flex items-center gap-1">
                {[1, 2, 0.5].map((a) => (
                  <Button key={a} variant={Math.abs(aspect - a) < 1e-6 ? 'primary' : 'default'} onClick={() => setAspect(a)} className="px-2">{a === 1 ? 'Kare' : a === 2 ? 'Yatay 2:1' : 'Dikey 1:2'}</Button>
                ))}
                <NumInput ariaLabel="Karo oranı" value={aspect} onChange={setAspect} min={0.1} max={10} step={0.05} className="w-16" />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[var(--color-text-muted)]">Izgara</span>
              <Segmented ariaLabel="Izgara" value={grid} onChange={setGrid} options={[4, 6, 8, 12, 16, 24].map((g) => ({ value: g, label: String(g) }))} />
              <label className="mt-1 flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 accent-[var(--color-accent)]" checked={snap} onChange={(e) => setSnap(e.target.checked)} />
                Noktalar ızgaraya otursun
              </label>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[var(--color-text-muted)]">Ön izleme (3 karo yan yana)</span>
              <svg viewBox={`0 0 ${preview.design.width} ${preview.design.height}`} className="w-full rounded border border-[var(--color-border)] bg-white">
                <path d={pathData(preview.contours)} fill="#3f3f46" fillRule="evenodd" />
                <path d={pathData(preview.contours.filter((c) => c.kind === 'island'))} fill="#dc2626" />
              </svg>
              {preview.stats.islandCount > 0 && (
                <p className="text-xs text-[var(--color-error)]">Kırmızı yerler hiçbir yere bağlı değil, kesilince düşer. Çizgiyi karo kenarına ya da başka bir çizgiye bağlayın.</p>
              )}
              {!shapes.length && <p className="text-xs text-[var(--color-text-dim)]">Henüz çizim yok.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
