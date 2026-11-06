import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { DEFAULT_DESIGN } from '../core/design';
import { buildPanel } from '../core/engine';
import { pathData } from '../core/export/svg';
import { readDxf } from '../core/import/dxf';
import { readSvg } from '../core/import/svg';
import { toPattern } from '../core/import/geometry';
import { newCustomId } from '../core/patterns/custom';
import type { CustomPattern } from '../core/patterns/custom';
import { Button, Segmented } from './ui';

/** SVG / DXF dosyasından desen alma: kipi seçtirir, ön izler, düzenleyiciye geçirir. */
export default function ImportDialog({ file, onCancel, onContinue }: {
  file: { name: string; text: string };
  onCancel: () => void;
  onContinue: (p: CustomPattern) => void;
}) {
  const [mode, setMode] = useState<'slot' | 'bar'>('slot');
  const [dropOuter, setDropOuter] = useState(true);
  const isDxf = /\.dxf$/i.test(file.name);

  const read = useMemo(() => {
    try {
      return { ok: true as const, ...(isDxf ? readDxf(file.text) : readSvg(file.text)) };
    } catch {
      return { ok: false as const };
    }
  }, [file, isDxf]);

  const built = useMemo(() => {
    if (!read.ok) return { error: 'Dosya okunamadı.' };
    try {
      const r = toPattern(read.paths, { mode, dropOuter });
      const pattern: CustomPattern = {
        id: newCustomId(), name: file.name.replace(/\.[^.]+$/, '').slice(0, 60) || 'Desenim',
        kind: mode, aspect: r.aspect, symmetry: 'yok', shapes: r.shapes,
      };
      const w = 300;
      const preview = buildPanel({
        ...DEFAULT_DESIGN, width: w, height: Math.min(600, Math.max(80, w / r.aspect)), frameSide: 6, frameTopBottom: 6,
        cols: 1, rows: 1, squareTiles: false, divider: 0, bar: 3, slot: 3, minGap: 1, patternId: pattern.id, custom: pattern,
      });
      return { r, pattern, preview };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Dosya okunamadı.' };
    }
  }, [read, mode, dropOuter, file.name]);

  const skipped = read.ok ? Object.entries(read.skipped) : [];

  return (
    <div role="dialog" aria-modal="true" aria-label="Dosyadan desen al" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-full w-full max-w-lg flex-col gap-3 overflow-y-auto rounded-xl bg-[var(--color-bg-card)] p-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">Dosyadan desen al: {file.name}</h2>
          <Button variant="ghost" title="Kapat" onClick={onCancel}><X size={16} /></Button>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[var(--color-text-muted)]">Dosyadaki çizgiler ne olsun?</span>
          <Segmented ariaLabel="Kip" value={mode} onChange={setMode} options={[
            { value: 'slot', label: 'Kesim çizgisi (boşluk)', title: 'Hazır plazma / lazer dosyası: kapalı şekiller kesilip boşluk olur' },
            { value: 'bar', label: 'Metal çubuk', title: 'Çizgiler kalınlaştırılıp metal çubuk olur (desen çizimi)' },
          ]} />
          <p className="text-[11px] leading-snug text-[var(--color-text-dim)]">
            {mode === 'slot'
              ? 'İnternetten indirilen hazır kesim dosyaları için: her kapalı şekil kesilip atılan boşluk olur.'
              : 'Çizgi çizimi için: her çizgi, "çubuk kalınlığı" kadar metal çubuk olur.'}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-[var(--color-accent)]" checked={dropOuter} onChange={(e) => setDropOuter(e.target.checked)} />
          En dıştaki kenarı at (dosyadaki panelin kendi çerçevesi)
        </label>
        {'error' in built ? (
          <p className="text-sm text-[var(--color-error)]">{built.error}</p>
        ) : (
          <>
            <svg viewBox={`0 0 ${built.preview.design.width} ${built.preview.design.height}`} className="max-h-[50vh] w-full rounded border border-[var(--color-border)] bg-white">
              <path d={pathData(built.preview.contours)} fill="#3f3f46" fillRule="evenodd" />
              <path d={pathData(built.preview.contours.filter((c) => c.kind === 'island'))} fill="#dc2626" />
            </svg>
            <p className="text-xs text-[var(--color-text-muted)]">
              {built.r.closedCount} kapalı, {built.r.openCount} açık çizgi{built.r.droppedOuter ? ' · dış kenar atıldı' : ''}
              {built.preview.stats.islandCount > 0 && <span className="text-[var(--color-error)]"> · {built.preview.stats.islandCount} düşen parça (kırmızı)</span>}
            </p>
          </>
        )}
        {skipped.length > 0 && (
          <p className="text-[11px] text-[var(--color-warning)]">Okunmayan öğeler: {skipped.map(([k, v]) => `${k} (${v})`).join(', ')}. Bloklar ve yazılar alınmaz; gerekirse çizim programında "patlat / explode" edin.</p>
        )}
        <div className="flex justify-end gap-2">
          <Button onClick={onCancel}>Vazgeç</Button>
          <Button variant="primary" disabled={'error' in built} onClick={() => { if (!('error' in built)) onContinue(built.pattern); }}>Düzenleyicide aç</Button>
        </div>
      </div>
    </div>
  );
}
