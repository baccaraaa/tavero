import type { MDXComponents } from 'mdx/types';
import { CodeBlock } from '@/components/CodeBlock';
import { EXTERNAL } from '@/lib/site';

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: (p) => <h1 className="font-serif text-d2 leading-[1.06] text-ink" {...p} />,
    h2: (p) => <h2 className="mt-12 mb-3 text-h2 font-semibold text-ink" {...p} />,
    h3: (p) => <h3 className="mt-8 mb-2 text-h3 font-semibold text-ink" {...p} />,
    p: (p) => <p className="my-4 text-ink-2" {...p} />,
    ul: (p) => <ul className="my-4 list-disc pl-6 text-ink-2 marker:text-ink-3" {...p} />,
    ol: (p) => <ol className="my-4 list-decimal pl-6 text-ink-2 marker:text-ink-3" {...p} />,
    li: (p) => <li className="my-1" {...p} />,
    a: (p) => <a className="text-accent underline underline-offset-3" {...(/^https?:/.test(p.href ?? '') ? EXTERNAL : {})} {...p} />,
    code: (p) => <code className="font-mono text-meta text-ink" {...p} />,
    pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
    table: (p) => <div tabIndex={0} className="my-6 overflow-x-auto"><table className="w-full border-collapse text-ui" {...p} /></div>,
    th: (p) => <th className="border-b border-line py-2 pr-4 text-left text-meta font-medium text-ink-3" {...p} />,
    td: (p) => <td className="border-b border-line py-2 pr-4 align-top text-ink-2" {...p} />,
    ...components,
  };
}
