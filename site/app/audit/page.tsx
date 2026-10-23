import { readAudit } from '@/lib/audit';
import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta({ title: 'Audit', description: 'This site is checked by Tavero itself before it is published: 0 high and medium findings, plus Lighthouse, axe and three screen widths.', path: '/audit/' });

export default function AuditPage() {
  const a = readAudit();
  return (
    <div className="mx-auto max-w-[1120px] px-6 pt-12 md:px-8 md:pt-18">
      <h1 className="font-serif text-d2 leading-[1.06] md:text-d2-lg">This site is audited by Tavero</h1>
      <p className="mt-4 max-w-[60ch] text-lead text-ink-2">
        Before this site is published, Tavero scans its pages in dev mode at mobile, tablet and desktop widths, and the audit fails if a high or medium finding is open. The same audit checks Lighthouse scores, accessibility with axe, and horizontal scrolling at each width.
      </p>
      {a ? (
        <>
          <dl className="mt-8 grid max-w-[640px] grid-cols-2 gap-6 border-t border-line pt-6 sm:grid-cols-4">
            <div><dt className="text-meta text-ink-3">Pages</dt><dd className="text-h2 font-semibold text-ink">{a.pages}</dd></div>
            <div><dt className="text-meta text-ink-3">High</dt><dd className="text-h2 font-semibold text-ink">{a.high}</dd></div>
            <div><dt className="text-meta text-ink-3">Medium</dt><dd className="text-h2 font-semibold text-ink">{a.medium}</dd></div>
            <div><dt className="text-meta text-ink-3">Info</dt><dd className="text-h2 font-semibold text-ink">{a.info}</dd></div>
          </dl>
          <p className="mt-6 text-ui text-ink-2">Scanned {new Date(a.at).toISOString().slice(0, 10)}. <a href="/audit/report.html" className="text-accent underline underline-offset-3">Read the full report</a></p>
        </>
      ) : (
        <p className="mt-8 text-ui text-ink-2">The audit has not run on this build yet.</p>
      )}
    </div>
  );
}
