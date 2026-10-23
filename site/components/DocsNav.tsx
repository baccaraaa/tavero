'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DOCS, docHref } from '@/lib/docs';

function Links() {
  const path = usePathname();
  return (
    <ul className="flex flex-col gap-1">
      {DOCS.map((d) => {
        const active = path === docHref(d.slug);
        return (
          <li key={d.slug}>
            <Link href={docHref(d.slug)} aria-current={active ? 'page' : undefined} className={`block rounded-sm px-3 py-2 text-ui ${active ? 'bg-wash font-medium text-ink' : 'text-ink-2 hover:text-ink'}`}>{d.title}</Link>
          </li>
        );
      })}
    </ul>
  );
}

/** A sticky column on desktop, a disclosure menu on phones. */
export function DocsNav() {
  return (
    <nav aria-label="Docs">
      <details className="rounded-md border border-line md:hidden">
        <summary className="cursor-pointer px-4 py-3 text-ui font-medium text-ink">Docs menu</summary>
        <div className="border-t border-line p-2"><Links /></div>
      </details>
      <div className="sticky top-8 hidden md:block"><Links /></div>
    </nav>
  );
}

/** Previous and next page at the bottom of every doc. */
export function DocsPager() {
  const path = usePathname();
  const i = DOCS.findIndex((d) => path === docHref(d.slug));
  if (i < 0) return null;
  const prev = DOCS[i - 1];
  const next = DOCS[i + 1];
  return (
    <div className="mt-18 flex justify-between gap-6 border-t border-line pt-6 text-ui">
      {prev ? <Link href={docHref(prev.slug)} className="text-ink-2 hover:text-ink"><span className="block text-meta text-ink-3">Previous</span>{prev.title}</Link> : <span />}
      {next && <Link href={docHref(next.slug)} className="text-right text-ink-2 hover:text-ink"><span className="block text-meta text-ink-3">Next</span>{next.title}</Link>}
    </div>
  );
}
