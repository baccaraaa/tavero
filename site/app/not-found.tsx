import { Button } from '@/components/Button';
export default function NotFound() {
  return (
    <div className="mx-auto max-w-[1120px] px-6 py-28 md:px-8">
      <h1 className="font-serif text-d2 leading-[1.06]">This page does not exist.</h1>
      <p className="mt-4 max-w-[50ch] text-lead text-ink-2">The link may be old. These pages do:</p>
      <div className="mt-8 flex flex-wrap gap-3"><Button href="/">Home</Button><Button href="/docs/quick-start/" variant="secondary">Docs</Button><Button href="/demo/" variant="secondary">Demo</Button></div>
    </div>
  );
}
