import { Button } from '@/components/Button';
import { demo } from '@/lib/data';

export const metadata = { title: 'Demo', description: 'The Tavero panel on a scan of the Acme demo dashboard.' };

export default function DemoPage() {
  const f = demo.findings;
  return (
    <div className="mx-auto max-w-[1120px] px-6 pt-12 md:px-8 md:pt-18">
      <h1 className="font-serif text-d2 leading-[1.06] md:text-d2-lg">The panel on the Acme demo</h1>
      <p className="mt-4 max-w-[60ch] text-lead text-ink-2">
        Acme is a small dashboard made for this demo, with drift added on purpose: a button copied from an old marketing page, buttons written in page markup, cards with their own borders, colors typed by hand. Tavero scanned its {demo.routes} pages at {demo.widths} widths and found {f.high} high, {f.medium} medium and {f.info} info findings.
      </p>
      <p className="mt-4 max-w-[60ch] text-ui text-ink-2">
        The screenshot is the panel as you use it in your project, choosing the canonical button. Open the panel to browse the whole scan: it is a read-only export made with <code className="font-mono text-meta text-ink">tavero ui --export</code>, with the canonical button already chosen, so the button findings show what the agent will see. It is made for wide screens.
      </p>
      <div className="mt-8"><Button href="/demo/panel/index.html">Open the panel</Button></div>
      {/* a screenshot, not an embed: the panel is a full-window app and is opened on its own page */}
      <a href="/demo/panel/index.html" className="mt-8 block overflow-hidden rounded-lg border border-line shadow-e2">
        <img src={demo.panel.src1x} srcSet={`${demo.panel.src1x} ${demo.panel.w / 2}w, ${demo.panel.src} ${demo.panel.w}w`} sizes="(min-width: 1120px) 1056px, 100vw" alt="The Tavero panel on the Acme scan, on the button styles finding" width={demo.panel.w / 2} height={demo.panel.h / 2} className="block h-auto w-full" />
      </a>
    </div>
  );
}
