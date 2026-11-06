/** Türkçe sayı biçimi (ondalıkta virgül). */
export const fmt = (v: number, digits = 1) => v.toLocaleString('tr-TR', { maximumFractionDigits: digits });

/** Virgüllü ya da noktalı yazılan sayıyı okur. */
export const parseNum = (s: string): number => Number(s.replace(/\s/g, '').replace(',', '.'));
