'use client';
import { useId, useRef, useState, type ReactNode, type KeyboardEvent } from 'react';

/** Tabs with arrow-key navigation; the tab list scrolls on narrow screens instead of wrapping. */
export function Tabs({ tabs, label }: { tabs: Array<{ label: string; body: ReactNode }>; label: string }) {
  const [active, setActive] = useState(0);
  const id = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const onKey = (e: KeyboardEvent) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = (active + d + tabs.length) % tabs.length;
    setActive(next);
    refs.current[next]?.focus();
  };
  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <div role="tablist" aria-label={label} onKeyDown={onKey} className="flex gap-1 overflow-x-auto border-b border-line bg-wash p-1">
        {tabs.map((t, i) => (
          <button
            key={t.label}
            ref={(el) => { refs.current[i] = el; }}
            role="tab"
            id={`${id}-t${i}`}
            aria-selected={i === active}
            aria-controls={`${id}-p${i}`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            className={`shrink-0 rounded-sm border px-3 py-2 text-meta ${i === active ? 'border-line bg-paper text-ink' : 'border-transparent text-ink-2 hover:text-ink'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t, i) => (
        <div key={t.label} role="tabpanel" id={`${id}-p${i}`} aria-labelledby={`${id}-t${i}`} hidden={i !== active}>{t.body}</div>
      ))}
    </div>
  );
}
