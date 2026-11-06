import { create } from 'zustand';
import { DEFAULT_DESIGN, normalizeDesign } from '../core/design';
import type { Design } from '../core/design';

const STORAGE_KEY = 'desenci:tasarim';
/** Bu süre içinde aynı alanlarda yapılan değişiklikler (kaydırıcı sürükleme) tek geri al adımıdır. */
const MERGE_MS = 600;
const HISTORY_LIMIT = 100;

function loadSaved(): Design {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizeDesign(JSON.parse(raw));
  } catch { /* tarayıcı kaydı yok ya da okunamıyor */ }
  return DEFAULT_DESIGN;
}

function save(d: Design) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch { /* kayıt kapalı */ }
}

interface DesignState {
  design: Design;
  past: Design[];
  future: Design[];
  lastKey: string;
  lastAt: number;
  /** Ayarları değiştirir (geri alınabilir). */
  update: (patch: Partial<Design>) => void;
  /** Bütün tasarımı değiştirir (dosya açma, yeni). */
  replace: (d: Design) => void;
  undo: () => void;
  redo: () => void;
}

export const useDesign = create<DesignState>((set, get) => ({
  design: loadSaved(),
  past: [],
  future: [],
  lastKey: '',
  lastAt: 0,
  update: (patch) => {
    const s = get();
    const next = normalizeDesign({ ...s.design, ...patch });
    const key = Object.keys(patch).sort().join(',');
    const now = Date.now();
    const merge = key === s.lastKey && now - s.lastAt < MERGE_MS && s.past.length > 0;
    save(next);
    set({
      design: next,
      past: merge ? s.past : [...s.past, s.design].slice(-HISTORY_LIMIT),
      future: [],
      lastKey: key,
      lastAt: now,
    });
  },
  replace: (d) => {
    const s = get();
    const next = normalizeDesign(d);
    save(next);
    set({ design: next, past: [...s.past, s.design].slice(-HISTORY_LIMIT), future: [], lastKey: '', lastAt: 0 });
  },
  undo: () => {
    const s = get();
    const prev = s.past[s.past.length - 1];
    if (!prev) return;
    save(prev);
    set({ design: prev, past: s.past.slice(0, -1), future: [s.design, ...s.future], lastKey: '' });
  },
  redo: () => {
    const s = get();
    const next = s.future[0];
    if (!next) return;
    save(next);
    set({ design: next, past: [...s.past, s.design], future: s.future.slice(1), lastKey: '' });
  },
}));
