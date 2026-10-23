import Link from 'next/link';
import type { ReactNode } from 'react';

const STYLES = {
  primary: 'bg-ink text-paper border-ink hover:bg-ink-2 hover:border-ink-2',
  secondary: 'bg-paper text-ink border-line-2 hover:border-ink-3',
} as const;

/** Two filled kinds and a plain link; hover changes color, never size. */
export function Button({ href, variant = 'primary', children }: { href: string; variant?: keyof typeof STYLES | 'link'; children: ReactNode }) {
  if (variant === 'link') return <Link href={href} className="text-ui text-accent underline underline-offset-3">{children}</Link>;
  const className = `inline-flex items-center rounded-md border px-4 py-3 text-ui leading-none font-medium ${STYLES[variant]}`;
  // static files outside the app (the exported panel) are plain links: the router cannot prefetch or render them
  if (href.endsWith('.html')) return <a href={href} className={className}>{children}</a>;
  return <Link href={href} className={className}>{children}</Link>;
}
