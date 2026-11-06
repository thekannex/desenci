import { customToDef } from './custom';
import type { CustomPattern } from './custom';
import { getPattern } from './library';
import type { PatternDef } from './types';

/** Tasarımda seçili desen: hazır desen ya da tasarıma gömülü kullanıcı deseni. */
export function resolvePattern(d: { patternId: string; custom?: CustomPattern | null }): PatternDef {
  if (d.custom && d.custom.id === d.patternId) return customToDef(d.custom);
  return getPattern(d.patternId);
}
