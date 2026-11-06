import type { Design } from '../core/design';
import { EDGE_KIND_LABELS, EDGE_LABELS, EDGE_SIDES, bendCalc, isBend } from '../core/edges';
import type { EdgeKind, EdgeSide } from '../core/edges';
import { useDesign } from '../stores/design-store';
import { fmt } from './format';
import { NumInput, Section, Toggle } from './ui';

const KINDS = Object.keys(EDGE_KIND_LABELS) as EdgeKind[];
const selectClass = 'h-8 min-w-0 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] px-1.5 text-sm';

/** Kenar işlemi: kenar başına büküm kanadı ya da geçmeli şerit. */
export default function EdgeControls() {
  const d = useDesign((s) => s.design);
  const update = useDesign((s) => s.update);
  const set = <K extends keyof Design>(key: K) => (v: Design[K]) => update({ [key]: v } as Partial<Design>);
  const setEdge = (s: EdgeSide, patch: Partial<Design['edges'][EdgeSide]>) => update({ edges: { ...d.edges, [s]: { ...d.edges[s], ...patch } } });
  const setAll = (kind: EdgeKind) => update({ edges: Object.fromEntries(EDGE_SIDES.map((s) => [s, { ...d.edges[s], kind }])) as Design['edges'] });

  const anyBend = EDGE_SIDES.some((s) => isBend(d.edges[s].kind));
  const anyStrip = EDGE_SIDES.some((s) => d.edges[s].kind === 'serit');
  const bend = bendCalc(d.thickness, d.bendRadius, d.kFactor);
  const label = 'flex flex-col gap-1 text-xs font-medium text-[var(--color-text-muted)]';

  return (
    <Section title="Kenar işlemi (büküm / geçme)">
      <div className="grid grid-cols-[2.5rem_1fr_4.5rem_1.25rem] items-center gap-x-2 gap-y-1.5">
        <span />
        <span className="text-[11px] text-[var(--color-text-dim)]">İşlem</span>
        <span className="text-right text-[11px] text-[var(--color-text-dim)]">Yükseklik</span>
        <span />
        {EDGE_SIDES.map((s) => {
          const e = d.edges[s];
          return (
            <div key={s} className="contents">
              <span className="text-sm">{EDGE_LABELS[s]}</span>
              <select aria-label={`${EDGE_LABELS[s]} kenar işlemi`} value={e.kind} onChange={(ev) => setEdge(s, { kind: ev.target.value as EdgeKind })} className={selectClass}>
                {KINDS.map((k) => <option key={k} value={k}>{EDGE_KIND_LABELS[k]}</option>)}
              </select>
              <NumInput ariaLabel={`${EDGE_LABELS[s]} kenar yüksekliği`} value={e.height} onChange={(v) => setEdge(s, { height: v })} min={1} max={2000}
                className={`w-full ${e.kind === 'yok' ? 'opacity-40' : ''}`} />
              <span className="text-xs text-[var(--color-text-dim)]">mm</span>
            </div>
          );
        })}
      </div>
      <label className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
        Hepsine:
        <select aria-label="Bütün kenarlara uygula" value="" onChange={(ev) => { if (ev.target.value) setAll(ev.target.value as EdgeKind); }} className={`${selectClass} flex-1`}>
          <option value="">Seç…</option>
          {KINDS.map((k) => <option key={k} value={k}>{EDGE_KIND_LABELS[k]}</option>)}
        </select>
      </label>

      {anyBend && (
        <div className="flex flex-col gap-2 rounded-md border border-[var(--color-border)] p-2.5">
          <span className="text-xs font-semibold">Büküm</span>
          <div className="grid grid-cols-2 gap-2">
            <label className={label}>
              İç büküm yarıçapı (mm)
              <NumInput value={d.bendRadius} onChange={set('bendRadius')} min={0} max={100} step={0.5} />
            </label>
            <label className={label}>
              K katsayısı
              <NumInput value={d.kFactor} onChange={set('kFactor')} min={0.2} max={0.5} step={0.01} />
            </label>
          </div>
          <Toggle label="Büküm çizgisi uçlarına işaret çentiği" checked={d.bendNotch} onChange={set('bendNotch')} />
          <p className="rounded bg-[var(--color-bg-input)] px-2 py-1.5 text-xs text-[var(--color-text-muted)]">
            {fmt(d.thickness)} mm sacta büküm payı <b className="text-[var(--color-text)]">{fmt(bend.bd, 2)} mm</b>. Yükseklik kanadın dış ölçüsüdür; panel en × boy bükümden sonraki dış ölçüdür.
          </p>
          <p className="text-[11px] leading-snug text-[var(--color-text-dim)]">
            Yarıçap genelde sac kalınlığı kadar, K 0,40–0,45 arasıdır. Abkantınızda deneme bükümü ölçüye uymazsa K'yı değiştirin.
          </p>
        </div>
      )}

      {anyStrip && (
        <div className="flex flex-col gap-2 rounded-md border border-[var(--color-border)] p-2.5">
          <span className="text-xs font-semibold">Geçmeli şerit</span>
          <label className={label}>
            Kenardan uzaklık (mm)
            <NumInput value={d.stripOffset} onChange={set('stripOffset')} min={0} max={1000} step={0.5} />
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label className={label}>
              Diş boyu
              <NumInput value={d.tabLength} onChange={set('tabLength')} min={3} max={1000} />
            </label>
            <label className={label}>
              Diş aralığı
              <NumInput value={d.tabSpacing} onChange={set('tabSpacing')} min={20} max={5000} step={10} />
            </label>
            <label className={label}>
              Yuva payı
              <NumInput value={d.slotClearance} onChange={set('slotClearance')} min={0} max={5} step={0.1} />
            </label>
          </div>
          <p className="text-[11px] leading-snug text-[var(--color-text-dim)]">
            Şerit panelin arka yüzüne dik oturur, altındaki dişler paneldeki yuvalara girer, sonra kaynatılır. Uzaklık 0 iken şerit panelin dış kenarıyla aynı hizadadır; yuvalar kenardan açık çentik olur. Şeritler kesim dosyasında panelin altına dizilir.
          </p>
        </div>
      )}
    </Section>
  );
}
