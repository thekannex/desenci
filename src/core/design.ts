import { PATTERNS } from './patterns/library';
import { sanitizeCustom } from './patterns/custom';
import type { CustomPattern } from './patterns/custom';
import { DEFAULT_EDGES, EDGE_KIND_LABELS, EDGE_SIDES } from './edges';
import type { EdgeKind, Edges } from './edges';

/** Panelin bütün ayarları; ölçüler mm. */
export interface Design {
  name: string;
  /** Panelin dış ölçüsü */
  width: number;
  height: number;
  /** Dış çerçeve: sağ / sol kenar ve üst / alt kenar genişliği */
  frameSide: number;
  frameTopBottom: number;
  /** Karolar arasındaki metal şerit (0: desenler birbirine akar) */
  divider: number;
  /** Yatay (sütun) ve dikey (sıra) karo sayısı */
  cols: number;
  rows: number;
  /** Açıkken sıra sayısı karolar desenin oranına (çoğunda kare) en yakın olacak biçimde kendiliğinden seçilir */
  squareTiles: boolean;
  patternId: string;
  /** Seçili desen kullanıcı deseniyse tanımı (proje dosyası başka bilgisayarda da açılsın diye tasarıma gömülür) */
  custom: CustomPattern | null;
  /** Desen başına özel ayar (desen kimliği → değer) */
  params: Record<string, number>;
  /** Çubuk desenlerinde metal çubuk kalınlığı */
  bar: number;
  /** Yarık desenlerinde kesik genişliği */
  slot: number;
  rotate: 0 | 90 | 180 | 270;
  /** Bir atlayarak (tek sütunlar / tek sıralar) aynala */
  mirrorX: boolean;
  mirrorY: boolean;
  /** Boşluk köşelerine verilen yarıçap (plazma köşede fazla yakar) */
  cornerRadius: number;
  /** Bundan dar boşluklar kesilmez (metal kalır) */
  minGap: number;
  /** Sac kalınlığı (ağırlık ve uyarılar) */
  thickness: number;
  /** Aynı panelden kaç adet */
  quantity: number;
  /** Kesim süresi tahmini */
  cutSpeed: number; // mm/dk
  pierceTime: number; // sn
  /** Çerçevede bağlantı delikleri */
  mountHoles: boolean;
  mountDiameter: number;
  mountSpacing: number;
  /** Kenar işlemi: büküm kanadı ya da geçmeli şerit (kenar başına) */
  edges: Edges;
  /** İç büküm yarıçapı ve K katsayısı (büküm payı hesabı) */
  bendRadius: number;
  kFactor: number;
  /** Büküm çizgisinin uçlarına işaret çentiği */
  bendNotch: boolean;
  /** Geçmeli şerit dişi: boy, en çok aralık, yuva boşluğu */
  tabLength: number;
  tabSpacing: number;
  slotClearance: number;
  /** Şeridin panel kenarına uzaklığı (0: kenarla aynı hizada) */
  stripOffset: number;
}

export const DEFAULT_DESIGN: Design = {
  name: 'Korkuluk',
  width: 1000,
  height: 900,
  frameSide: 30,
  frameTopBottom: 30,
  divider: 10,
  cols: 5,
  rows: 4,
  squareTiles: true,
  patternId: 'kafes',
  custom: null,
  params: {},
  bar: 10,
  slot: 10,
  rotate: 0,
  mirrorX: false,
  mirrorY: false,
  cornerRadius: 0,
  minGap: 4,
  thickness: 3,
  quantity: 1,
  cutSpeed: 2500,
  pierceTime: 1,
  mountHoles: false,
  mountDiameter: 10,
  mountSpacing: 400,
  edges: DEFAULT_EDGES,
  bendRadius: 3,
  kFactor: 0.44,
  bendNotch: true,
  tabLength: 30,
  tabSpacing: 250,
  slotClearance: 0.5,
  stripOffset: 0,
};

/** Sık kullanılan panel ölçüleri. */
export const PRESETS: { name: string; width: number; height: number }[] = [
  { name: 'Balkon korkuluğu', width: 1000, height: 900 },
  { name: 'Cam korkuluk paneli', width: 1200, height: 1000 },
  { name: 'Merdiven korkuluğu', width: 900, height: 850 },
  { name: 'Paravan', width: 1000, height: 2000 },
  { name: 'Bahçe kapısı paneli', width: 1000, height: 1600 },
  { name: 'Tavan / duvar paneli', width: 600, height: 600 },
];

const num = (v: unknown, def: number, min: number, max: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def;
const int = (v: unknown, def: number, min: number, max: number): number => Math.round(num(v, def, min, max));
const bool = (v: unknown, def: boolean): boolean => (typeof v === 'boolean' ? v : def);

function normalizeEdges(raw: unknown): Edges {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, { kind?: unknown; height?: unknown }>;
  const out = { ...DEFAULT_EDGES };
  for (const s of EDGE_SIDES) {
    const e = r[s];
    const kind = e && typeof e.kind === 'string' && e.kind in EDGE_KIND_LABELS ? (e.kind as EdgeKind) : 'yok';
    out[s] = { kind, height: num(e?.height, DEFAULT_EDGES[s].height, 1, 2000) };
  }
  return out;
}

/** Kayıttan / dosyadan gelen eksik ya da bozuk veriyi geçerli bir tasarıma tamamlar. */
export function normalizeDesign(raw: unknown): Design {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof Design, unknown>>;
  const d = DEFAULT_DESIGN;
  const params: Record<string, number> = {};
  if (r.params && typeof r.params === 'object') {
    for (const [k, v] of Object.entries(r.params as Record<string, unknown>)) if (typeof v === 'number' && Number.isFinite(v)) params[k] = v;
  }
  const custom = sanitizeCustom(r.custom);
  const rotate = [0, 90, 180, 270].includes(r.rotate as number) ? (r.rotate as Design['rotate']) : 0;
  return {
    name: typeof r.name === 'string' ? r.name.slice(0, 80) : d.name,
    width: num(r.width, d.width, 20, 20000),
    height: num(r.height, d.height, 20, 20000),
    frameSide: num(r.frameSide, d.frameSide, 0, 2000),
    frameTopBottom: num(r.frameTopBottom, d.frameTopBottom, 0, 2000),
    divider: num(r.divider, d.divider, 0, 500),
    cols: int(r.cols, d.cols, 1, 100),
    rows: int(r.rows, d.rows, 1, 100),
    squareTiles: bool(r.squareTiles, d.squareTiles),
    patternId: typeof r.patternId === 'string' && (PATTERNS.some((p) => p.id === r.patternId) || custom?.id === r.patternId) ? r.patternId : d.patternId,
    custom,
    params,
    bar: num(r.bar, d.bar, 0.5, 500),
    slot: num(r.slot, d.slot, 0.5, 500),
    rotate,
    mirrorX: bool(r.mirrorX, d.mirrorX),
    mirrorY: bool(r.mirrorY, d.mirrorY),
    cornerRadius: num(r.cornerRadius, d.cornerRadius, 0, 200),
    minGap: num(r.minGap, d.minGap, 0, 200),
    thickness: num(r.thickness, d.thickness, 0.1, 100),
    quantity: int(r.quantity, d.quantity, 1, 9999),
    cutSpeed: num(r.cutSpeed, d.cutSpeed, 10, 100000),
    pierceTime: num(r.pierceTime, d.pierceTime, 0, 60),
    mountHoles: bool(r.mountHoles, d.mountHoles),
    mountDiameter: num(r.mountDiameter, d.mountDiameter, 1, 200),
    mountSpacing: num(r.mountSpacing, d.mountSpacing, 20, 20000),
    edges: normalizeEdges(r.edges),
    bendRadius: num(r.bendRadius, d.bendRadius, 0, 100),
    kFactor: num(r.kFactor, d.kFactor, 0.2, 0.5),
    bendNotch: bool(r.bendNotch, d.bendNotch),
    tabLength: num(r.tabLength, d.tabLength, 3, 1000),
    tabSpacing: num(r.tabSpacing, d.tabSpacing, 20, 5000),
    slotClearance: num(r.slotClearance, d.slotClearance, 0, 5),
    stripOffset: num(r.stripOffset, d.stripOffset, 0, 1000),
  };
}
