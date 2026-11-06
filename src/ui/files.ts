import { normalizeDesign } from '../core/design';
import type { Design } from '../core/design';
import type { PanelResult } from '../core/engine';
import { toSvg } from '../core/export/svg';

/** Dosya adında sorun çıkaran karakterleri ayıklar. */
export function baseName(d: Design): string {
  const name = d.name.trim().replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '-') || 'desen';
  return `${name}-${Math.round(d.width)}x${Math.round(d.height)}`;
}

export function download(fileName: string, data: Blob | string, type = 'text/plain') {
  const blob = typeof data === 'string' ? new Blob([data], { type }) : data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Dolu görünümü PNG resmine çevirir (uzun kenar 2400 piksel). */
export function toPng(r: PanelResult): Promise<Blob> {
  const svg = toSvg(r, 'filled');
  const { width: W, height: H } = r.design;
  const k = 2400 / Math.max(W, H);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = Math.round(W * k);
      c.height = Math.round(H * k);
      const ctx = c.getContext('2d');
      if (!ctx) { reject(new Error('Çizim yüzeyi açılamadı')); return; }
      ctx.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('Resim oluşturulamadı'))), 'image/png');
    };
    img.onerror = () => reject(new Error('Resim oluşturulamadı'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

/** Proje dosyası (.desenci.json) içeriği. */
export const projectJson = (d: Design) => JSON.stringify({ program: 'Desenci', surum: __APP_VERSION__, tasarim: d }, null, 2);

/** Proje dosyasını okur; eski / eksik dosyalar tamamlanır. */
export function parseProject(text: string): Design {
  const data = JSON.parse(text) as { tasarim?: unknown };
  if (!data || typeof data !== 'object' || !('tasarim' in data)) throw new Error('Bu bir Desenci proje dosyası değil.');
  return normalizeDesign(data.tasarim);
}

/** Dosya seçtirip adını ve içeriğini okur. */
export function pickFile(accept: string): Promise<{ name: string; text: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) { resolve(null); return; }
      void f.text().then((text) => resolve({ name: f.name, text }), () => resolve(null));
    };
    input.click();
  });
}
