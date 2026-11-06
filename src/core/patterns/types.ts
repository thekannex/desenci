import type { Shape } from './shapes';

/** Desenin kendine özgü ayarı (ör. iç karenin boyu, çubuk sayısı, yıldız açısı). */
export interface PatternParam {
  label: string;
  min: number;
  max: number;
  step: number;
  def: number;
  /** Ekranda sayının yanındaki birim (yoksa tam sayıda "adet", ondalıkta boş) */
  unit?: string;
  /** Tam sayı ayarında her değerin adı (ör. dolgu deseni); ekranda kaydırıcının altında görünür */
  names?: string[];
}

export interface PatternDef {
  id: string;
  name: string;
  /** bar: çizgiler metal çubuk; slot: karo dolu sac, çizgiler kesilen yarık */
  kind: 'bar' | 'slot';
  group: string;
  param?: PatternParam;
  param2?: PatternParam;
  /** Desen biriminin eni / boyu (altıgen düzende 1'den farklı); "desen oranı" açıkken karolar bu orana yakın seçilir */
  aspect?: number;
  /** Kesintisiz desen: karo arası 0 iken komşu karolarla birleşip tek desen olur */
  seamless?: boolean;
  /** Küçük resimde yan yana kaç birim (kesintisiz desende; yoksa 2) */
  thumbCols?: number;
  /**
   * Desen öğeleri (birim karoda). tileAspect: karonun gerçek eni / boyu (desenin kendi yönünde); daire ve
   * kıvrımları bozulmadan çizmek isteyen desenler kullanır, öteki desenler yok sayar.
   */
  build: (k: number, k2: number, tileAspect: number) => Shape[];
}
