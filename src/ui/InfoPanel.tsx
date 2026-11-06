import { AlertTriangle, FileCode2, Image, Info, Scissors, XCircle } from 'lucide-react';
import type { PanelResult } from '../core/engine';
import { toDxf } from '../core/export/dxf';
import { toSvg } from '../core/export/svg';
import { useDesign } from '../stores/design-store';
import { EDGE_LABELS } from '../core/edges';
import { baseName, download, toPng } from './files';
import { Button, NumInput, Section } from './ui';
import { fmt } from './format';

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-0.5 text-sm">
      <span className="text-[var(--color-text-muted)]">{label}</span>
      <span className={`tabular-nums ${strong ? 'font-semibold' : ''}`}>{value}</span>
    </div>
  );
}

const ICONS = { error: XCircle, warn: AlertTriangle, info: Info };
const COLORS = { error: 'text-[var(--color-error)]', warn: 'text-[var(--color-warning)]', info: 'text-[var(--color-info)]' };

/** Sağ taraf: ölçümler, uyarılar ve dosya çıktıları. */
export default function InfoPanel({ result }: { result: PanelResult }) {
  const update = useDesign((s) => s.update);
  const d = result.design;
  const s = result.stats;
  const q = d.quantity;
  const minutes = (v: number) => (v < 1 ? `${fmt(v * 60, 0)} sn` : v < 60 ? `${fmt(v)} dk` : `${fmt(Math.floor(v / 60), 0)} sa ${fmt(v % 60, 0)} dk`);
  const blocked = s.holeCount === 0 && s.mountCount === 0;
  const name = baseName(d);

  return (
    <div className="flex flex-col">
      <Section title="Kesim dosyası">
        <Button variant="primary" disabled={blocked} onClick={() => download(`${name}.dxf`, toDxf(result), 'application/dxf')}
          title="DXF olarak indir (plazma / CAM programı için)">
          <Scissors size={15} /> DXF indir
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button disabled={blocked} onClick={() => download(`${name}.svg`, toSvg(result, 'cut'), 'image/svg+xml')} title="Kesim çizgilerini SVG olarak indir">
            <FileCode2 size={15} /> SVG
          </Button>
          <Button onClick={() => void toPng(result).then((b) => download(`${name}.png`, b))} title="Müşteriye göstermek için resim indir">
            <Image size={15} /> Resim
          </Button>
        </div>
        <p className="text-[11px] leading-snug text-[var(--color-text-dim)]">
          Ölçüler mm, sol alt köşe 0,0. Katmanlar: DIS_KONTUR (dış kenar), IC_KONTUR (boşluklar), BAGLANTI_DELIGI{s.slotCount > 0 && ', GECME_YUVASI'}{s.partCount > 0 && ', PARCA (şeritler)'}{result.bends.length > 0 && ', BUKUM_ARKAYA / BUKUM_ONE (büküm çizgisi, kesilmez)'}. Kesim sırası içten dışa.
        </p>
      </Section>

      {result.warnings.length > 0 && (
        <Section title="Uyarılar">
          <ul className="flex flex-col gap-2">
            {result.warnings.map((w) => {
              const Icon = ICONS[w.level];
              return (
                <li key={w.text} className="flex gap-2 text-xs leading-snug">
                  <Icon size={15} className={`mt-px shrink-0 ${COLORS[w.level]}`} />
                  <span>{w.text}</span>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      <Section title="Panel bilgisi">
        <div>
          <Row label="Ölçü" value={`${fmt(d.width)} × ${fmt(d.height)} mm`} strong />
          {result.edges && <Row label="Açınım (düz sac)" value={`${fmt(s.flatW)} × ${fmt(s.flatH)} mm`} strong />}
          <Row label="Karo" value={`${s.cols} × ${s.rows} adet`} />
          <Row label="Karo ölçüsü" value={`${fmt(s.tileW)} × ${fmt(s.tileH)} mm`} />
          <Row label="Boşluk sayısı" value={fmt(s.holeCount, 0)} />
          {s.mountCount > 0 && <Row label="Bağlantı deliği" value={fmt(s.mountCount, 0)} />}
          {s.islandCount > 0 && <Row label="Düşen parça" value={fmt(s.islandCount, 0)} />}
          <Row label="Açıklık oranı" value={`%${fmt(s.openRatio * 100, 0)}`} />
          {s.slotCount > 0 && <Row label="Geçme yuvası" value={fmt(s.slotCount, 0)} />}
          {(result.edges?.notchCount ?? 0) > 0 && <Row label="Kenar diş çentiği" value={fmt(result.edges!.notchCount, 0)} />}
          <Row label="Kalan sac alanı" value={`${fmt(s.metalArea / 1e6, 3)} m²`} />
          <Row label={`Ağırlık (${fmt(d.thickness)} mm sac)`} value={`${fmt(s.weight, 2)} kg`} strong />
        </div>
      </Section>

      {result.edges && (
        <Section title="Büküm ve parçalar">
          <div>
            {result.bends.map((b) => (
              <Row key={b.side} label={`${EDGE_LABELS[b.side]} kanat`} value={`${fmt(d.edges[b.side].height)} mm, ${b.kind === 'arka' ? 'arkaya' : 'öne'} 90°`} />
            ))}
            {result.bends.length > 0 && <Row label="Büküm payı" value={`${fmt(result.edges.bend.bd, 2)} mm`} />}
            {result.edges.parts.map((p) => (
              <Row key={p.side} label={p.name} value={`${fmt(p.length)} × ${fmt(p.height)} mm, ${p.tabs} diş`} />
            ))}
          </div>
          {result.edges.parts.length > 0 && <p className="text-[11px] leading-snug text-[var(--color-text-dim)]">Şerit yüksekliğine diş (sac kalınlığı kadar) dahil değildir.</p>}
        </Section>
      )}

      <Section title="Kesim">
        <div>
          <Row label="Kesim boyu" value={`${fmt(s.cutLength / 1000, 2)} m`} strong />
          <Row label="Delme sayısı" value={fmt(s.pierces, 0)} />
          <Row label="Tahmini süre" value={minutes(s.cutMinutes)} />
        </div>
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="adet" className="text-sm text-[var(--color-text-muted)]">Panel adedi</label>
          <NumInput id="adet" value={q} onChange={(v) => update({ quantity: v })} min={1} max={9999} className="w-20" />
        </div>
        {q > 1 && (
          <div className="rounded-md bg-[var(--color-bg-input)] px-3 py-2">
            <Row label={`${q} panel ağırlık`} value={`${fmt(s.weight * q, 1)} kg`} strong />
            <Row label={`${q} panel kesim boyu`} value={`${fmt((s.cutLength * q) / 1000, 1)} m`} />
            <Row label={`${q} panel süre`} value={minutes(s.cutMinutes * q)} />
            <Row label="Sac (fire hariç)" value={`${fmt((d.width * d.height * q) / 1e6, 2)} m²`} />
          </div>
        )}
      </Section>
    </div>
  );
}
