'use client';
import { useState } from 'react';

/** The small copy control next to a command or code. */
export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => { void navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}
      className="shrink-0 rounded-sm border border-line-2 bg-paper px-2 py-1 font-sans text-xs font-medium text-ink-2 hover:text-ink"
      aria-label={`Copy ${text}`}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}
