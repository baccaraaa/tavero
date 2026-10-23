import { CodeBlock } from './CodeBlock';
import { reference } from '@/lib/data';

/** `tavero --help` and `tavero <command> --help`, captured from the built CLI at site build time. */
export function CliReference() {
  return (
    <>
      <CodeBlock comment="$ tavero --help">{reference.global}</CodeBlock>
      {reference.cli.map((c) => (
        <section key={c.command} id={c.command}>
          <h2 className="mt-12 mb-3 text-h2 font-semibold text-ink"><code className="font-mono">tavero {c.command}</code></h2>
          <CodeBlock>{c.help}</CodeBlock>
        </section>
      ))}
    </>
  );
}
