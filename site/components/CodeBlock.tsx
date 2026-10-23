import type { ReactNode } from 'react';

/** Muted code: comments in ink-3, everything else ink; no rainbow highlighting. */
export function CodeBlock({ children, comment }: { children: ReactNode; comment?: string }) {
  return (
    <pre tabIndex={0} className="my-4 overflow-x-auto rounded-md border border-line bg-wash px-4 py-3 font-mono text-meta leading-[1.7] text-ink">
      {comment && <span className="text-ink-3">{comment}{'\n'}</span>}
      {children}
    </pre>
  );
}
