import { Button } from '@/components/Button';
import { Command } from '@/components/Command';
import { Crop } from '@/components/Crop';
import { FindingSheet } from '@/components/FindingSheet';
import { Transcript } from '@/components/Transcript';
import { ClientConfigs } from '@/components/ClientConfigs';
import { Card } from '@/components/Card';
import { demo, reference, transcript } from '@/lib/data';
import { pageMeta } from '@/lib/seo';
import { SITE } from '@/lib/site';

export const metadata = pageMeta({ description: SITE.description, path: '/' });

/** Structured data for search engines: what Tavero is, that it is free, where its code lives. */
const LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Tavero',
  description: SITE.description,
  url: SITE.url,
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Windows, macOS, Linux',
  license: 'https://opensource.org/licenses/MIT',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  sameAs: [SITE.github, SITE.npm].filter(Boolean),
};

const STEPS = [
  ['Read the context', 'Canonical components, tokens and conventions, in about 1,500 tokens.'],
  ['Open a finding', 'The file and line, the current value, and the token or component to use.'],
  ['Fix and rescan', 'Only the routes and the rule it touched. Seconds, not minutes.'],
  ['Check the diff', 'Done when the finding is listed as resolved.'],
] as const;

const DECISIONS = [
  ['Fix', 'Confirmed work. The agent sees it first.'],
  ['Intended', 'Hidden from the agent until the finding grows.'],
  ['Canonical', 'The reference variant, with a name, used as the expected value.'],
  ['Note', 'A message delivered with the finding.'],
] as const;

function Section({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line">
      <div className="mx-auto max-w-[1120px] px-6 py-18 md:px-8 md:py-28">
        <h2 className="max-w-[18ch] font-serif text-d2 leading-[1.06] md:text-d2-lg">{title}</h2>
        <p className="mt-4 max-w-[58ch] text-lead text-ink-2">{intro}</p>
        {children}
      </div>
    </section>
  );
}

export default function Home() {
  const drift = demo.buttons.rows.filter((r) => !r.canonical);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(LD) }} />
      <div className="mx-auto max-w-[1120px] px-6 pt-18 pb-18 md:px-8 md:pt-28">
        <h1 className="max-w-[12ch] font-serif text-d2-lg leading-none md:max-w-[16ch] md:text-d1-lg">Keep the UI your agent writes consistent.</h1>
        <p className="mt-6 max-w-[50ch] text-lead md:text-lead-lg text-ink-2">
          Tavero scans your running React app, finds drift in buttons, cards, colors and spacing, and gives your coding agent each fix with the file, the line and the token to use. Free and open source.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Command text="npm i -D tavero" />
          <Button href="/demo/">Open the demo</Button>
          <Button href="/docs/quick-start/" variant="secondary">Read the docs</Button>
        </div>
        <div className="mt-12 md:mt-18"><FindingSheet demo={demo} /></div>
      </div>

      <Section title="What Tavero finds" intro={`Four rules, run on what the browser renders at mobile, tablet and desktop widths. Every finding names the component and the source line. Examples from the Acme demo, ${demo.routes} pages.`}>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <Card>
            <h3 className="text-h3 font-semibold">Buttons</h3>
            <p className="mt-1 text-ui text-ink-2">Distinct button styles, near duplicates, and buttons written in page markup instead of the shared component.</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">{drift.slice(0, 3).map((r) => <Crop key={r.where} img={r.crop} alt={`Button written in ${r.component}`} max={36} />)}</div>
          </Card>
          <Card>
            <h3 className="text-h3 font-semibold">Cards</h3>
            <p className="mt-1 text-ui text-ink-2">Card-like containers that differ in background, border, radius, padding or shadow. {demo.cards.title} in the demo.</p>
            <div className="mt-4 flex flex-wrap items-end gap-3">{demo.cards.crops.filter((c) => c.w <= 480).map((c) => <Crop key={c.src} img={c} alt="Card style from the demo" max={96} />)}</div>
          </Card>
          <Card>
            <h3 className="text-h3 font-semibold">Colors</h3>
            <p className="mt-1 text-ui text-ink-2">Colors outside your tokens, the nearest token, and the place where the literal is written.</p>
            {demo.color && (
              <p className="mt-4 flex flex-wrap items-center gap-3 font-mono text-xs text-ink-3">
                <span className="text-ink">{demo.color.hex}</span><span>{demo.color.where}</span>{demo.color.expected && <span>→ {demo.color.expected}</span>}
              </p>
            )}
          </Card>
          <Card>
            <h3 className="text-h3 font-semibold">Scales</h3>
            <p className="mt-1 text-ui text-ink-2">Radius, spacing, font size and shadow values that are not on the scale your tokens declare.</p>
            <p className="mt-4 font-mono text-xs text-ink-3">radius off the scale: <span className="text-ink">{demo.radius.used.join(', ')}</span> · declared: {demo.radius.declared.join(', ')}</p>
          </Card>
        </div>
      </Section>

      <Section title="Your agent closes the findings" intro="Tavero runs as an MCP server. The agent reads the design context before writing UI, picks a finding, fixes it, rescans only what it touched and checks the diff.">
        <div className="mt-12 grid gap-12 md:grid-cols-[1fr_1.15fr]">
          <ol>{STEPS.map(([t, d]) => <li key={t} className="border-t border-line py-4"><p className="font-semibold text-ink">{t}</p><p className="text-ui text-ink-2">{d}</p></li>)}</ol>
          <Transcript t={transcript} />
        </div>
      </Section>

      <Section title="You decide what is intended" intro="A local panel for the person behind the agent. Go through the findings with the keyboard. Each decision reaches the agent on its next call, without a rescan.">
        <div className="mt-12 overflow-hidden rounded-lg border border-line shadow-e2">
          <img src={demo.panel.src1x} srcSet={`${demo.panel.src1x} ${demo.panel.w / 2}w, ${demo.panel.src} ${demo.panel.w}w`} sizes="(min-width: 1120px) 1056px, 100vw" alt="The Tavero panel choosing the canonical button for the Acme demo" width={demo.panel.w / 2} height={demo.panel.h / 2} loading="lazy" decoding="async" className="block h-auto w-full" />
        </div>
        <p className="mt-3 text-meta text-ink-3">The canonical picker for the Acme buttons. <a href="/demo/" className="text-accent underline underline-offset-3">Open this panel</a></p>
        <dl className="mt-8 grid gap-6 sm:grid-cols-2 md:grid-cols-4">
          {DECISIONS.map(([t, d]) => <div key={t}><dt className="font-semibold text-ink">{t}</dt><dd className="text-ui text-ink-2">{d}</dd></div>)}
        </dl>
      </Section>

      <Section title="Install" intro="Add the package, then give your client the MCP config. Every config below is printed by tavero mcp --print-config.">
        <div className="mt-8"><Command text="npm i -D tavero" /></div>
        <div className="mt-8"><ClientConfigs configs={reference.configs} /></div>
        <p className="mt-6 text-ui text-ink-2">Then ask your agent to read <code className="font-mono text-meta text-ink">tavero_context</code> before it writes UI. <a href="/docs/quick-start/" className="text-accent underline underline-offset-3">Quick start</a></p>
      </Section>
    </>
  );
}
