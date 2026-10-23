export const DOCS = [
  { slug: 'quick-start', title: 'Quick start', summary: 'Install, log in, run the first scan and read the findings.', description: 'Install Tavero, log in to your app, run the first scan of your React app and read the findings with file, line and the expected token.' },
  { slug: 'mcp', title: 'MCP and clients', summary: 'Connect Claude Code, Cursor, Codex, Gemini CLI, Antigravity, VS Code or Windsurf.', description: "Connect Tavero's MCP server to Claude Code, Cursor, Codex, Gemini CLI, Antigravity, VS Code or Windsurf, with the config each client needs." },
  { slug: 'cli', title: 'CLI reference', summary: 'Every command and option, printed by the tool itself.', description: 'Every Tavero command and option: scan, findings, finding, context, diff, report, ui, mcp and more, generated from the CLI itself.' },
  { slug: 'rules', title: 'Rules', summary: 'What the buttons, cards, colors and scales rules report.', description: 'What Tavero reports in React apps: button and card style drift, colors outside your design tokens, and spacing, radius and type off your scale.' },
  { slug: 'panel', title: 'Panel and decisions', summary: 'Fix, Intended, Canonical and Note, and where they are stored.', description: 'The local Tavero panel: mark findings as Fix or Intended, choose the canonical button or card, leave notes for your coding agent.' },
  { slug: 'agents', title: 'For agents', summary: 'Instructions for AGENTS.md, the Agent Skill and the nine MCP tools.', description: 'Make your coding agent keep the UI consistent: the AGENTS.md snippet, the Tavero Agent Skill and the nine MCP tools.' },
  { slug: 'faq', title: 'FAQ', summary: 'Supported stacks, logins, what Tavero writes, privacy.', description: 'Which React apps Tavero supports, why it needs the dev server, logins, what it writes, rescan speed, privacy and license.' },
] as const;

export const docHref = (slug: string) => `/docs/${slug}/`;
