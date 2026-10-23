import Link from 'next/link';
import { EXTERNAL, SITE } from '@/lib/site';
import { readAudit } from '@/lib/audit';

export function Footer() {
  const a = readAudit();
  return (
    <footer className="mt-28 border-t border-line">
      <div className="mx-auto flex max-w-[1120px] flex-col gap-4 px-6 py-12 text-ui text-ink-3 md:flex-row md:items-center md:gap-8 md:px-8">
        <span>Tavero · MIT license</span>
        <Link href="/docs/quick-start/" className="hover:text-ink">Docs</Link>
        <Link href="/demo/" className="hover:text-ink">Demo</Link>
        <a href={SITE.npm} {...EXTERNAL} className="hover:text-ink">npm</a>
        {SITE.github && <a href={SITE.github} {...EXTERNAL} className="hover:text-ink">GitHub</a>}
        <Link href="/audit/" className="hover:text-ink md:ml-auto">This site is audited by Tavero{a ? `: ${a.high + a.medium} high and medium findings` : ''}</Link>
      </div>
    </footer>
  );
}
