import { Crop } from './Crop';
import type { Demo, DemoRow } from '@/lib/data';

const label = (r: DemoRow) => (r.name ? `${r.component} "${r.name}"` : r.component === 'Button' ? 'Button' : `written in ${r.component}`);

/** The landing page's main exhibit: one real finding from the Acme scan. */
export function FindingSheet({ demo }: { demo: Demo }) {
  const primary = demo.buttons.rows.find((r) => r.canonical === 'primary');
  const drift = demo.buttons.rows.filter((r) => !r.canonical);
  const rows = [...(primary ? [primary] : []), ...drift];
  const allowed = demo.buttons.rows.filter((r) => r.canonical === 'allowed' && r.name).map((r) => `"${r.name}"`);
  return (
    <figure className="rounded-lg border border-line bg-paper p-6 shadow-e2">
      <figcaption>
        <p className="text-meta text-ink-3"><span className="font-medium text-high">High</span> · buttons · Acme demo, {demo.routes} pages at {demo.widths} widths</p>
        <p className="mt-1 text-lead font-semibold text-ink">{demo.buttons.title}</p>
      </figcaption>
      <ul className="mt-4">
        {rows.map((r) => (
          <li key={r.where + r.signature} className="grid grid-cols-1 items-center gap-2 border-t border-line py-3 sm:grid-cols-[176px_1fr_auto] sm:gap-6">
            <div className="flex h-12 w-fit items-center rounded-sm border border-line bg-wash px-2 sm:w-auto"><Crop img={r.crop} alt={`${label(r)} as rendered`} max={36} /></div>
            <div className="min-w-0">
              <p className="text-ui text-ink">{label(r)}{r.canonical === 'primary' && <span className="text-ink-3"> · canonical</span>}<span className="text-ink-3 sm:hidden"> · {r.uses} renders</span></p>
              <p className="truncate font-mono text-xs text-ink-3" title={r.signature}>{r.where} · {r.signature}</p>
            </div>
            <p className="hidden text-meta text-ink-3 sm:block sm:text-right">{r.uses} renders</p>
          </li>
        ))}
      </ul>
      <p className="mt-4 border-t border-line pt-4 text-ui text-ink-2">
        Expected on the {drift.length} other styles: <span className="font-semibold text-ink">{primary ? label(primary) : 'the canonical button'}</span>{allowed.length ? `, or the allowed ${allowed.join(' and ')}` : ''}, chosen by a person in the panel.
      </p>
    </figure>
  );
}
