export const DOCS = [
  { slug: 'quick-start', title: 'Quick start', summary: 'Install, log in, run the first scan and read the findings.' },
  { slug: 'mcp', title: 'MCP and clients', summary: 'Connect Claude Code, Cursor, Codex, Gemini CLI, Antigravity, VS Code or Windsurf.' },
  { slug: 'cli', title: 'CLI reference', summary: 'Every command and option, printed by the tool itself.' },
  { slug: 'rules', title: 'Rules', summary: 'What the buttons, cards, colors and scales rules report.' },
  { slug: 'panel', title: 'Panel and decisions', summary: 'Fix, Intended, Canonical and Note, and where they are stored.' },
  { slug: 'agents', title: 'For agents', summary: 'Instructions for AGENTS.md, the Agent Skill and the nine MCP tools.' },
  { slug: 'faq', title: 'FAQ', summary: 'Supported stacks, logins, what Tavero writes, privacy.' },
] as const;

export const docHref = (slug: string) => `/docs/${slug}/`;
