import { Card } from './Card';
import type { Transcript as T } from '@/lib/data';

const COLOR = { call: 'text-ink-3', out: 'text-ink', ok: 'text-ok', note: 'text-ink-3' } as const;

/** A real agent run, recorded on a copy of the Acme demo and trimmed to the calls and their key output. */
export function Transcript({ t }: { t: T }) {
  return (
    <Card className="font-mono text-meta leading-[1.75]">
      {t.lines.map((l, i) => <p key={i} className={`${COLOR[l.kind]} break-words`}>{l.kind === 'call' ? `› ${l.text}` : l.text}</p>)}
      <p className="mt-3 text-ink-3">{t.model}, no shell, {t.seconds} s, {t.turns} turns. Recorded on a copy of the Acme demo.</p>
    </Card>
  );
}
