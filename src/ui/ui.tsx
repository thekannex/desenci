import { useEffect, useId, useState } from 'react';
import type { ReactNode } from 'react';
import { fmt, parseNum } from './format';

/** Yazarken bozulmayan sayı kutusu: Enter'da ya da çıkınca uygular. */
export function NumInput({ value, onChange, min, max, step = 1, className = '', ariaLabel, id }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; className?: string; ariaLabel?: string; id?: string;
}) {
  const [text, setText] = useState(fmt(value, 2));
  const [editing, setEditing] = useState(false);
  useEffect(() => { if (!editing) setText(fmt(value, 2)); }, [value, editing]);
  const commit = () => {
    setEditing(false);
    const v = parseNum(text);
    if (!Number.isFinite(v)) { setText(fmt(value, 2)); return; }
    const c = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v));
    if (c !== value) onChange(c);
    setText(fmt(c, 2));
  };
  return (
    <input
      id={id}
      aria-label={ariaLabel}
      inputMode="decimal"
      className={`h-8 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] px-2 text-right text-sm tabular-nums focus:border-[var(--color-border-focus)] ${className}`}
      value={text}
      onFocus={(e) => { setEditing(true); e.currentTarget.select(); }}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
        if (e.key === 'Escape') { setText(fmt(value, 2)); setEditing(false); (e.currentTarget as HTMLInputElement).blur(); }
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          const v = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, value + (e.key === 'ArrowUp' ? step : -step)));
          onChange(Math.round(v * 1000) / 1000);
        }
      }}
    />
  );
}

/** Kaydırıcı + sayı kutusu. Sayı kutusuna kaydırıcı sınırının dışında (hardMax'a kadar) değer yazılabilir. */
export function SliderField({ label, value, onChange, min, max, step = 1, unit = 'mm', hardMax, disabled, hint }: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; unit?: string; hardMax?: number; disabled?: boolean; hint?: ReactNode;
}) {
  const id = useId();
  return (
    <div className={`flex flex-col gap-1 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-xs font-medium text-[var(--color-text-muted)]">{label}</label>
        <div className="flex items-center gap-1">
          <NumInput id={id} value={value} onChange={onChange} min={min} max={hardMax ?? max} step={step} className="w-20" />
          {unit && <span className="w-6 text-xs text-[var(--color-text-dim)]">{unit}</span>}
        </div>
      </div>
      <input
        type="range" aria-label={label} min={min} max={max} step={step} disabled={disabled}
        value={Math.min(max, Math.max(min, value))}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
      {hint && <p className="text-[11px] leading-snug text-[var(--color-text-dim)]">{hint}</p>}
    </div>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm select-none">
      <input type="checkbox" className="size-4 accent-[var(--color-accent)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-b border-[var(--color-border)] px-4 py-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold tracking-wider text-[var(--color-text)] uppercase">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Button({ children, onClick, title, variant = 'default', disabled, className = '' }: {
  children: ReactNode; onClick?: () => void; title?: string; variant?: 'default' | 'primary' | 'ghost'; disabled?: boolean; className?: string;
}) {
  const styles = {
    default: 'border border-[var(--color-border)] bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-hover)]',
    primary: 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]',
    ghost: 'hover:bg-[var(--color-bg-hover)]',
  }[variant];
  return (
    <button type="button" title={title} aria-label={title} disabled={disabled} onClick={onClick}
      className={`flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-40 ${styles} ${className}`}>
      {children}
    </button>
  );
}

/** Birkaç seçenekten biri (düğme grubu). */
export function Segmented<T extends string | number>({ value, options, onChange, ariaLabel }: {
  value: T; options: { value: T; label: ReactNode; title?: string }[]; onChange: (v: T) => void; ariaLabel: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex rounded-md border border-[var(--color-border)] bg-[var(--color-bg-input)] p-0.5">
      {options.map((o) => (
        <button key={String(o.value)} type="button" role="radio" aria-checked={o.value === value} title={o.title}
          onClick={() => onChange(o.value)}
          className={`flex h-7 flex-1 items-center justify-center rounded px-2 text-xs font-medium transition-colors ${o.value === value ? 'bg-[var(--color-bg-card)] text-[var(--color-accent)] shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
