import { FlipHorizontal2, FlipVertical2 } from 'lucide-react';
import { PRESETS } from '../core/design';
import type { Design } from '../core/design';
import { computeLayout } from '../core/layout';
import { paramKey, patternParam, tileAspect } from '../core/patterns/library';
import type { PatternParam } from '../core/patterns/library';
import { resolvePattern } from '../core/patterns/resolve';
import { useDesign } from '../stores/design-store';
import PatternPicker from './PatternPicker';
import EdgeControls from './EdgeControls';
import { NumInput, Section, Segmented, SliderField, Toggle } from './ui';
import { fmt } from './format';

/** Sol taraftaki bütün ayarlar. */
export default function Controls() {
  const d = useDesign((s) => s.design);
  const update = useDesign((s) => s.update);
  const set = <K extends keyof Design>(key: K) => (v: Design[K]) => update({ [key]: v } as Partial<Design>);
  const pattern = resolvePattern(d);
  const layout = computeLayout(d, tileAspect(pattern, d.rotate));
  const paramSlider = (p: PatternParam | undefined, which: 1 | 2) => p && (
    <SliderField label={p.label} value={patternParam(pattern, d.params, which)} min={p.min} max={p.max} step={p.step}
      unit={p.unit ?? (p.step < 1 ? '' : 'adet')}
      hint={p.names ? p.names[Math.round(patternParam(pattern, d.params, which) - p.min)] : undefined}
      onChange={(v) => update({ params: { ...d.params, [paramKey(pattern.id, which)]: v } })} />
  );
  const preset = PRESETS.find((p) => p.width === d.width && p.height === d.height);

  return (
    <div className="flex flex-col">
      <Section title="Panel ölçüsü">
        <select aria-label="Hazır ölçü" value={preset ? preset.name : ''}
          onChange={(e) => { const p = PRESETS.find((x) => x.name === e.target.value); if (p) update({ width: p.width, height: p.height }); }}
          className="h-8 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] px-2 text-sm">
          <option value="">Hazır ölçü seç…</option>
          {PRESETS.map((p) => <option key={p.name} value={p.name}>{p.name} ({p.width} × {p.height})</option>)}
        </select>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-[var(--color-text-muted)]">
            Genişlik (mm)
            <NumInput value={d.width} onChange={set('width')} min={20} max={20000} step={10} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-[var(--color-text-muted)]">
            Yükseklik (mm)
            <NumInput value={d.height} onChange={set('height')} min={20} max={20000} step={10} />
          </label>
        </div>
        <SliderField label="Yan çerçeve" value={d.frameSide} onChange={set('frameSide')} min={0} max={150} hardMax={2000} />
        <SliderField label="Üst / alt çerçeve" value={d.frameTopBottom} onChange={set('frameTopBottom')} min={0} max={150} hardMax={2000} />
      </Section>

      <Section title="Desen" right={<span className="text-xs font-medium text-[var(--color-accent)]">{pattern.name}</span>}>
        <PatternPicker />
        {paramSlider(pattern.param, 1)}
        {paramSlider(pattern.param2, 2)}
        {pattern.kind === 'bar' ? (
          <SliderField label="Çubuk kalınlığı" value={d.bar} onChange={set('bar')} min={2} max={60} step={0.5} hardMax={500}
            hint="Desen çizgilerinin metal genişliği. Sac kalınlığından ince olmasın." />
        ) : (
          <SliderField label="Yarık genişliği" value={d.slot} onChange={set('slot')} min={2} max={60} step={0.5} hardMax={500}
            hint="Bu desende karo dolu sactır; çizgiler kesilip açılan yarıklardır." />
        )}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[var(--color-text-muted)]">Döndür</span>
          <Segmented ariaLabel="Döndür" value={d.rotate} onChange={set('rotate')}
            options={[0, 90, 180, 270].map((v) => ({ value: v as Design['rotate'], label: `${v}°` }))} />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-[var(--color-text-muted)]">Bir atlayarak aynala</span>
          <div className="flex gap-4">
            <span className="flex items-center gap-1"><FlipHorizontal2 size={14} className="text-[var(--color-text-dim)]" /><Toggle label="Yatayda" checked={d.mirrorX} onChange={set('mirrorX')} /></span>
            <span className="flex items-center gap-1"><FlipVertical2 size={14} className="text-[var(--color-text-dim)]" /><Toggle label="Dikeyde" checked={d.mirrorY} onChange={set('mirrorY')} /></span>
          </div>
        </div>
      </Section>

      <Section title="Yerleşim">
        <SliderField label="Yatayda karo" value={d.cols} onChange={set('cols')} min={1} max={30} hardMax={100} unit="adet" />
        <SliderField label="Dikeyde karo" value={d.squareTiles ? layout.rows : d.rows} onChange={(v) => update({ rows: v, squareTiles: false })}
          min={1} max={30} hardMax={100} unit="adet" />
        <Toggle label={(pattern.aspect ?? 1) === 1 ? 'Karolar kare olsun (dikey adet kendiliğinden)' : 'Karolar desenin oranında olsun (dikey adet kendiliğinden)'} checked={d.squareTiles}
          onChange={(v) => update(v ? { squareTiles: true } : { squareTiles: false, rows: layout.rows })} />
        <SliderField label="Karo arası" value={d.divider} onChange={set('divider')} min={0} max={60} step={0.5} hardMax={500}
          hint={d.divider === 0 ? 'Karo arası 0: desenler birbirine bağlanır, tek parça desen gibi olur.' : pattern.seamless ? 'Bu desen kesintisizdir; karo arası 0 iken tek parça desen olur.' : undefined} />
        {!layout.error && (
          <div className="rounded-md bg-[var(--color-bg-input)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
            Karo ölçüsü <b className="text-[var(--color-text)]">{fmt(layout.tileW)} × {fmt(layout.tileH)} mm</b> · {layout.cols} × {layout.rows} = {layout.cols * layout.rows} karo
          </div>
        )}
      </Section>

      <EdgeControls />

      <Section title="Kesim ayarları">
        <SliderField label="Sac kalınlığı" value={d.thickness} onChange={set('thickness')} min={0.5} max={20} step={0.5} hardMax={100} />
        <SliderField label="Köşe yuvarlatma" value={d.cornerRadius} onChange={set('cornerRadius')} min={0} max={20} step={0.5} hardMax={200}
          hint="Boşluk köşelerine ve boşluğa giren sivri metal uçlara yarıçap verir; plazma keskin köşede fazla yakar, sivri uç da kullanımda keskin olur." />
        <SliderField label="En dar boşluk" value={d.minGap} onChange={set('minGap')} min={0} max={30} step={0.5} hardMax={200}
          hint="Bundan dar boşluklar kesilmez, metal kalır (torç çapına göre seçin)." />
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-[var(--color-text-muted)]">
            Kesim hızı (mm/dk)
            <NumInput value={d.cutSpeed} onChange={set('cutSpeed')} min={10} max={100000} step={100} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-[var(--color-text-muted)]">
            Delme süresi (sn)
            <NumInput value={d.pierceTime} onChange={set('pierceTime')} min={0} max={60} step={0.1} />
          </label>
        </div>
      </Section>

      <Section title="Bağlantı delikleri">
        <Toggle label="Çerçeveye vida / cıvata deliği aç" checked={d.mountHoles} onChange={set('mountHoles')} />
        {d.mountHoles && (
          <>
            <SliderField label="Delik çapı" value={d.mountDiameter} onChange={set('mountDiameter')} min={3} max={30} step={0.5} hardMax={200} />
            <SliderField label="En çok aralık" value={d.mountSpacing} onChange={set('mountSpacing')} min={50} max={1000} step={10} hardMax={20000} />
          </>
        )}
      </Section>
    </div>
  );
}
