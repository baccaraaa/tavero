import { CopyButton } from './CopyButton';

/** A shell command with a copy button. */
export function Command({ text }: { text: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-3 rounded-md border border-line bg-wash py-2 pr-2 pl-4 font-mono text-ui text-ink">
      <code className="overflow-x-auto whitespace-nowrap">{text}</code>
      <CopyButton text={text} />
    </span>
  );
}
