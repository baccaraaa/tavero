import { DocsNav, DocsPager } from '@/components/DocsNav';

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto grid max-w-[1120px] gap-8 px-6 pt-12 md:grid-cols-[200px_1fr] md:gap-12 md:px-8 md:pt-18">
      <DocsNav />
      <article className="min-w-0 max-w-[65ch] text-body leading-[1.7]">
        {children}
        <DocsPager />
      </article>
    </div>
  );
}
