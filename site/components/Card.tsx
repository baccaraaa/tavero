import type { ReactNode } from 'react';

/** The one card style on the site: paper, a hairline border, large radius. */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-line bg-paper p-6 ${className}`}>{children}</div>;
}
