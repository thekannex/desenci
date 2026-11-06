import { memo, useMemo, useState } from 'react';
import { Download, FileUp, Pencil, Plus, Upload } from 'lucide-react';
import { DEFAULT_DESIGN } from '../core/design';
import { buildPanel } from '../core/engine';
import { pathData } from '../core/export/svg';
import { CUSTOM_GROUP, customToDef, newCustomId } from '../core/patterns/custom';
import type { CustomPattern } from '../core/patterns/custom';
import { PATTERNS, PATTERN_GROUPS, paramKey } from '../core/patterns/library';
import type { PatternDef } from '../core/patterns/library';
import { resolvePattern } from '../core/patterns/resolve';
import { useDesign } from '../stores/design-store';
import { libraryJson, parseLibrary, useLibrary } from '../stores/library-store';
import { download, pickFile } from './files';
import ImportDialog from './ImportDialog';
import PatternEditor from './PatternEditor';
import { Button } from './ui';

const FILTER_KEY = 'desenci:desen-grubu';
const ALL = 'Tümü';

/** Desenin küçük resmi: gerçek motorla hesaplanır (ekrandaki ile kesilen aynı). */
const Thumb = memo(function Thumb({ patternId, custom, k, k2, seamless, cols = 2 }: { patternId: string; custom?: CustomPattern; k?: number; k2?: number; seamless?: boolean; cols?: number }) {
  const d = useMemo(() => {
    const params: Record<string, number> = {};
    if (k !== undefined) params[paramKey(patternId, 1)] = k;
    if (k2 !== undefined) params[paramKey(patternId, 2)] = k2;
    return pathData(buildPanel({
      ...DEFAULT_DESIGN, width: 100, height: 100, frameSide: 4, frameTopBottom: 4, cols: seamless ? cols : 1, rows: 1, squareTiles: !!seamless,
      divider: 0, patternId, custom: custom ?? null, params, bar: seamless ? 3.5 : 5, slot: 6, minGap: 0,
    }).contours);
  }, [patternId, custom, k, k2, seamless, cols]);
  return (
    <svg viewBox="0 0 100 100" className="block aspect-square w-full" aria-hidden>
      <path d={d} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
});

function thumbClass(active: boolean) {
  return `relative rounded-md border p-1 transition-colors ${active
    ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent-hover)] ring-1 ring-[var(--color-accent)]'
    : 'border-[var(--color-border)] bg-[var(--color-bg-card)] text-zinc-700 hover:border-[var(--color-text-dim)]'}`;
}

export default function PatternPicker() {
  const d = useDesign((s) => s.design);
  const update = useDesign((s) => s.update);
  const library = useLibrary((s) => s.patterns);
  const { save, remove, addMany } = useLibrary.getState();
  const [filter, setFilter] = useState<string>(() => {
    try { return localStorage.getItem(FILTER_KEY) ?? ALL; } catch { return ALL; }
  });
  const [editing, setEditing] = useState<{ pattern: CustomPattern; isNew: boolean } | null>(null);
  const [importing, setImporting] = useState<{ name: string; text: string } | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const chooseFilter = (f: string) => {
    setFilter(f);
    try { localStorage.setItem(FILTER_KEY, f); } catch { /* kayıt kapalı */ }
  };

  /** Desen seçimi: kesintisiz desende karo arası 0'a iner, ötekine geçince geri gelir. */
  const select = (p: PatternDef, custom: CustomPattern | null = null) => {
    const prev = resolvePattern(d);
    const patch: Parameters<typeof update>[0] = { patternId: p.id, custom };
    if (p.seamless && !prev.seamless && d.divider > 0) patch.divider = 0;
    if (!p.seamless && prev.seamless && d.divider === 0) patch.divider = Math.max(6, d.bar);
    update(patch);
  };

  const saveCustom = (p: CustomPattern) => {
    save(p);
    setEditing(null);
    select(customToDef(p), p);
  };

  const newPattern = (): CustomPattern => ({ id: newCustomId(), name: `Desenim ${library.length + 1}`, kind: 'bar', aspect: 1, symmetry: 'ayna4', shapes: [] });

  const importFile = async () => {
    const f = await pickFile('.svg,.dxf,image/svg+xml');
    if (f) setImporting(f);
  };

  const groups = filter === ALL ? [...PATTERN_GROUPS, CUSTOM_GROUP] : [filter];
  const chips = [ALL, ...PATTERN_GROUPS, CUSTOM_GROUP];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1" role="tablist" aria-label="Desen grubu">
        {chips.map((c) => (
          <button key={c} type="button" role="tab" aria-selected={filter === c} onClick={() => chooseFilter(c)}
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${filter === c
              ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white'
              : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-dim)]'}`}>
            {c}{c === CUSTOM_GROUP && library.length ? ` (${library.length})` : ''}
          </button>
        ))}
      </div>

      {groups.map((g) => (
        <div key={g}>
          <div className="mb-1.5 text-[11px] font-medium text-[var(--color-text-dim)]">{g}</div>
          {g === CUSTOM_GROUP ? (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-8 lg:grid-cols-5">
                {library.map((c) => (
                  <div key={c.id} className="group relative">
                    <button type="button" title={c.name} aria-label={c.name} aria-pressed={c.id === d.patternId}
                      onClick={() => select(customToDef(c), c)}
                      className={`w-full ${thumbClass(c.id === d.patternId)}`}>
                      <Thumb patternId={c.id} custom={c} />
                    </button>
                    <button type="button" title={`${c.name}: düzenle`} aria-label={`${c.name} desenini düzenle`} onClick={() => setEditing({ pattern: c, isNew: false })}
                      className="absolute top-0.5 right-0.5 rounded bg-white/90 p-0.5 text-[var(--color-text-muted)] opacity-80 shadow-sm hover:text-[var(--color-accent)] group-hover:opacity-100">
                      <Pencil size={11} />
                    </button>
                  </div>
                ))}
                <button type="button" title="Yeni desen çiz" aria-label="Yeni desen çiz" onClick={() => setEditing({ pattern: newPattern(), isNew: true })}
                  className="flex aspect-square flex-col items-center justify-center gap-0.5 rounded-md border border-dashed border-[var(--color-accent)] text-[10px] text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10">
                  <Plus size={16} /> Çiz
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button className="h-7 px-2 text-xs" title="SVG ya da DXF dosyasından desen al" onClick={() => void importFile()}><FileUp size={13} /> SVG / DXF al</Button>
                <Button className="h-7 px-2 text-xs" title="Desenlerimi dosyaya yedekle" disabled={!library.length} onClick={() => download('desenlerim.desenler.json', libraryJson(library), 'application/json')}><Download size={13} /> Yedekle</Button>
                <Button className="h-7 px-2 text-xs" title="Yedek dosyasından desen yükle" onClick={async () => {
                  const f = await pickFile('.json,application/json');
                  if (!f) return;
                  try { setNote(`${addMany(parseLibrary(f.text))} desen eklendi.`); } catch { setNote('Dosya okunamadı: Desenci desen yedeği değil.'); }
                }}><Upload size={13} /> Yedekten yükle</Button>
              </div>
              {note && <p role="status" className="text-xs text-[var(--color-text-muted)]">{note}</p>}
              {!library.length && <p className="text-[11px] leading-snug text-[var(--color-text-dim)]">Kendi deseninizi çizin ya da internetten indirdiğiniz SVG / DXF kesim dosyasını desen olarak alın.</p>}
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-8 lg:grid-cols-5">
              {PATTERNS.filter((p) => p.group === g).map((p) => (
                <button key={p.id} type="button" title={p.name} aria-label={p.name} aria-pressed={p.id === d.patternId} onClick={() => select(p)} className={thumbClass(p.id === d.patternId)}>
                  <Thumb patternId={p.id} k={d.params[paramKey(p.id, 1)]} k2={d.params[paramKey(p.id, 2)]} seamless={p.seamless} cols={p.thumbCols} />
                </button>
              ))}
            </div>
          )}
        </div>
      ))}

      {importing && (
        <ImportDialog file={importing} onCancel={() => setImporting(null)}
          onContinue={(p) => { setImporting(null); setEditing({ pattern: p, isNew: true }); }} />
      )}
      {editing && (
        <PatternEditor initial={editing.pattern} isNew={editing.isNew} onSave={saveCustom} onClose={() => setEditing(null)}
          onDelete={editing.isNew ? undefined : () => { remove(editing.pattern.id); setEditing(null); }} />
      )}
    </div>
  );
}
