import Link from 'next/link';
import { Logo } from './Logo';
import { SITE } from '@/lib/site';

export function Header() {
  const links = [...SITE.nav, ...(SITE.github ? [{ href: SITE.github, label: 'GitHub' }] : []), { href: SITE.npm, label: 'npm' }];
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex h-16 max-w-[1120px] items-center gap-6 px-6 md:px-8">
        <Link href="/" className="flex items-center gap-2 text-body font-semibold text-ink"><Logo />Tavero</Link>
        <nav aria-label="Main" className="ml-auto flex gap-6 text-ui">
          {links.map((l) => <Link key={l.href} href={l.href} className="text-ink-2 hover:text-ink">{l.label}</Link>)}
        </nav>
      </div>
    </header>
  );
}
