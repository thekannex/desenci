import { create } from 'zustand';
import { sanitizeCustom } from '../core/patterns/custom';
import type { CustomPattern } from '../core/patterns/custom';

/** Kullanıcının kendi desenleri ("Desenlerim"); tarayıcıda saklanır, dosyaya yedeklenebilir. */
const STORAGE_KEY = 'desenci:desenlerim';

function load(): CustomPattern[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as unknown;
    return Array.isArray(raw) ? raw.map(sanitizeCustom).filter((p): p is CustomPattern => p !== null) : [];
  } catch {
    return [];
  }
}

function persist(list: CustomPattern[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { /* kayıt kapalı ya da dolu */ }
}

interface LibraryState {
  patterns: CustomPattern[];
  /** Ekler ya da aynı kimlikliyi günceller */
  save: (p: CustomPattern) => void;
  remove: (id: string) => void;
  /** Yedekten / projeden gelenleri ekler (aynı kimlikliler güncellenir); eklenen sayısını döner */
  addMany: (list: CustomPattern[]) => number;
}

export const useLibrary = create<LibraryState>((set, get) => ({
  patterns: load(),
  save: (p) => {
    const list = get().patterns;
    const next = list.some((x) => x.id === p.id) ? list.map((x) => (x.id === p.id ? p : x)) : [...list, p];
    persist(next);
    set({ patterns: next });
  },
  remove: (id) => {
    const next = get().patterns.filter((x) => x.id !== id);
    persist(next);
    set({ patterns: next });
  },
  addMany: (items) => {
    let next = get().patterns;
    let added = 0;
    for (const p of items) {
      if (next.some((x) => x.id === p.id)) next = next.map((x) => (x.id === p.id ? p : x));
      else { next = [...next, p]; added++; }
    }
    persist(next);
    set({ patterns: next });
    return added;
  },
}));

/** Desen kütüphanesi yedek dosyası. */
export const libraryJson = (list: CustomPattern[]) => JSON.stringify({ program: 'Desenci', desenler: list }, null, 2);

export function parseLibrary(text: string): CustomPattern[] {
  const data = JSON.parse(text) as { desenler?: unknown; tasarim?: { custom?: unknown } };
  const raw = Array.isArray(data?.desenler) ? data.desenler : data?.tasarim?.custom ? [data.tasarim.custom] : null;
  if (!raw) throw new Error('Bu bir Desenci desen yedeği değil.');
  return raw.map(sanitizeCustom).filter((p): p is CustomPattern => p !== null);
}
