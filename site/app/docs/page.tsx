import Link from 'next/link';
import { DOCS, docHref } from '@/lib/docs';
import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta({ title: 'Docs', description: 'Tavero documentation: quick start, MCP setup for coding agents, CLI reference, the four rules, the panel and the FAQ.', path: '/docs/' });

export default function DocsIndex() {
  return (
    <>
      <h1 className="font-serif text-d2 leading-[1.06] text-ink">Docs</h1>
      <p className="my-4 text-ink-2">Tavero is a CLI, an MCP server and a local panel. Start with the quick start; the reference pages are generated from the tool.</p>
      <ul className="mt-8">
        {DOCS.map((d) => (
          <li key={d.slug} className="border-t border-line py-4">
            <Link href={docHref(d.slug)} className="font-semibold text-ink hover:text-accent">{d.title}</Link>
            <p className="text-ui text-ink-2">{d.summary}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
