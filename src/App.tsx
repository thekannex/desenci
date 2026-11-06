import { useEffect, useRef, useState } from 'react';
import { FilePlus2, FolderOpen, Redo2, Save, Undo2 } from 'lucide-react';
import { DEFAULT_DESIGN } from './core/design';
import { buildPanel } from './core/engine';
import { useDesign } from './stores/design-store';
import { useLibrary } from './stores/library-store';
import Controls from './ui/Controls';
import InfoPanel from './ui/InfoPanel';
import Preview from './ui/Preview';
import { baseName, download, parseProject, pickFile, projectJson } from './ui/files';
import { Button } from './ui/ui';
import logo from './assets/logo.svg?inline';

export default function App() {
  const design = useDesign((s) => s.design);
  const { update, replace, undo, redo } = useDesign.getState();
  const canUndo = useDesign((s) => s.past.length > 0);
  const canRedo = useDesign((s) => s.future.length > 0);
  // Kaydırıcı sürüklenirken arayüz takılmasın: hesap bir adım geriden gelebilir
  // Hesap zamanlayıcıyla yapılır: ağır desenlerde (son hesap uzun sürdüyse) kaydırıcı durunca hesaplanır,
  // her ara değerde baştan hesaplanıp ekran takılmaz
  const [result, setResult] = useState(() => buildPanel(design));
  const lastMs = useRef(0);
  useEffect(() => {
    const t = setTimeout(() => {
      const t0 = performance.now();
      setResult(buildPanel(design));
      lastMs.current = performance.now() - t0;
    }, lastMs.current > 150 ? 220 : 0);
    return () => clearTimeout(t);
  }, [design]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      // Açık pencere (desen çizimi) kendi kısayollarını kullanır
      if (document.body.dataset.modal) return;
      const t = e.target as HTMLElement | null;
      // Yazı kutusundayken tarayıcının kendi geri alması çalışsın
      if (t && (t.tagName === 'INPUT' && (t as HTMLInputElement).type !== 'range' && (t as HTMLInputElement).type !== 'checkbox')) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (key === 'y' || (key === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
      else if (key === 's') { e.preventDefault(); download(`${baseName(useDesign.getState().design)}.desenci.json`, projectJson(useDesign.getState().design), 'application/json'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(t);
  }, [message]);

  const open = async () => {
    const file = await pickFile('.json,application/json');
    if (file === null) return;
    try {
      const d = parseProject(file.text);
      replace(d);
      // Projedeki kullanıcı deseni "Desenlerim"e de eklenir
      if (d.custom && !useLibrary.getState().patterns.some((p) => p.id === d.custom!.id)) useLibrary.getState().addMany([d.custom]);
      setMessage('Proje açıldı.');
    } catch (err) {
      setMessage(err instanceof Error && err.message.includes('Desenci') ? err.message : 'Dosya okunamadı: Desenci proje dosyası değil.');
    }
  };

  return (
    <div className="flex min-h-screen flex-col lg:h-screen lg:overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-2">
        <div className="mr-2 flex items-center gap-2">
          <img src={logo} alt="" className="size-7" />
          <span className="text-sm font-bold tracking-[0.25em] text-[var(--color-accent)]">DESENCİ</span>
          <span className="text-[11px] text-[var(--color-text-dim)]">{__APP_VERSION__}</span>
        </div>
        <input aria-label="Tasarım adı" value={design.name} onChange={(e) => update({ name: e.target.value })}
          className="h-8 w-40 min-w-0 rounded-md sm:w-48 border border-transparent bg-transparent px-2 text-sm font-medium hover:border-[var(--color-border)] focus:border-[var(--color-border-focus)]" />
        <div className="flex items-center gap-1">
          <Button variant="ghost" title="Geri al (Ctrl+Z)" disabled={!canUndo} onClick={undo}><Undo2 size={16} /></Button>
          <Button variant="ghost" title="Yinele (Ctrl+Y)" disabled={!canRedo} onClick={redo}><Redo2 size={16} /></Button>
        </div>
        {message && <span role="status" className="text-xs text-[var(--color-text-muted)]">{message}</span>}
        <div className="ml-auto flex items-center gap-1.5">
          <Button title="Yeni tasarım" onClick={() => replace(DEFAULT_DESIGN)}><FilePlus2 size={15} /> Yeni</Button>
          <Button title="Kaydedilmiş projeyi aç" onClick={() => void open()}><FolderOpen size={15} /> Aç</Button>
          <Button title="Projeyi dosyaya kaydet (Ctrl+S)" onClick={() => download(`${baseName(design)}.desenci.json`, projectJson(design), 'application/json')}>
            <Save size={15} /> Kaydet
          </Button>
        </div>
      </header>
      {/* Küçük ekranda önizleme üstte, ayarlar ve bilgiler altta; sayfa kayar */}
      <main className="flex flex-1 flex-col lg:min-h-0 lg:flex-row">
        <aside className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-bg-card)] lg:w-[340px] lg:overflow-y-auto lg:border-r lg:border-b-0">
          <Controls />
        </aside>
        <div className="order-first flex h-[60vh] min-w-0 flex-col lg:order-none lg:h-auto lg:flex-1">
          <Preview result={result} busy={result.design !== design} />
        </div>
        <aside className="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-bg-card)] lg:w-[290px] lg:overflow-y-auto lg:border-t-0 lg:border-l">
          <InfoPanel result={result} />
        </aside>
      </main>
    </div>
  );
}
