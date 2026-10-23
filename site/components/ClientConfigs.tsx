import { Tabs } from './Tabs';
import { CLIENT_NAMES, type Reference } from '@/lib/data';

/** Every tab is the output of `tavero mcp --print-config <client>`. */
export function ClientConfigs({ configs }: { configs: Reference['configs'] }) {
  return (
    <Tabs
      label="MCP client"
      tabs={configs.map((c) => ({
        label: CLIENT_NAMES[c.client] ?? c.client,
        body: (
          <pre tabIndex={0} className="overflow-x-auto px-4 py-3 font-mono text-meta leading-[1.7] text-ink">
            <span className="text-ink-3">{`// ${c.file}`}</span>{'\n'}{c.text.trimEnd()}
          </pre>
        ),
      }))}
    />
  );
}
