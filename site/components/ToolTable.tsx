import { reference } from '@/lib/data';

const firstSentence = (s: string) => s.match(/^.*?\.(\s|$)/)?.[0].trim() ?? s;

/** The nine MCP tools as the server registers them. */
export function ToolTable() {
  return (
    <div tabIndex={0} className="my-6 overflow-x-auto">
      <table className="w-full border-collapse text-ui">
        <thead><tr><th className="border-b border-line py-2 pr-4 text-left text-meta font-medium text-ink-3">Tool</th><th className="border-b border-line py-2 pr-4 text-left text-meta font-medium text-ink-3">Does</th><th className="border-b border-line py-2 pr-4 text-left text-meta font-medium text-ink-3">Inputs</th></tr></thead>
        <tbody>
          {reference.tools.map((t) => (
            <tr key={t.name}>
              <td className="border-b border-line py-2 pr-4 align-top"><code className="font-mono text-meta text-ink">{t.name}</code></td>
              <td className="border-b border-line py-2 pr-4 align-top text-ink-2">{firstSentence(t.description)}</td>
              <td className="border-b border-line py-2 pr-4 align-top font-mono text-xs text-ink-3">{t.params.join(', ') || 'none'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
