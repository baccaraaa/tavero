# Changelog

## 0.6.0 — 2026-10-24

Found by running Tavero on open-source React dashboards (satnaing/shadcn-admin, arhamkhnz/next-shadcn-admin-dashboard).

- Routes are discovered at the widest viewport first. Phone layouts hide the navigation behind a menu button, so a crawl that started at mobile width found 2 routes of 28 in shadcn-admin. Delete `.tavero/routes.json` from earlier scans to rediscover.
- TanStack Router: routes are read from `routeTree.gen.ts`; params and splats are skipped with a reason.
- Declared routes are deduped by exact path: `/401`, `/403` and `/404` are separate pages; only crawled links collapse ids (`/items/1`, `/items/2`).
- Elements no app component renders are left out of findings: devtools toggles (TanStack Router and Query devtools), widgets mounted by other frameworks or scripts. The page itself (`html`, `body`) still counts.
- Elements entirely outside the page (a skip link waiting for focus) are left out.
- A `<button>` with a widget role (checkbox, switch, combobox, tab, radio, option…) is a form control, not a button; shadcn's sidebar (`data-slot="sidebar"`) counts as navigation, and navigation icon buttons are left out like text ones.
- An unstyled button with more than 40 characters of text or 48px or more in height is a list row (chat, mail, a clickable card), not an action button; `role="alert"`, `status` and `dialog` boxes are not cards.
- Element text leaves out `<style>` and `<script>` content (chart libraries inject styles into elements).
- Default-exported functions are indexed whatever their case: Next pages written as `export default function page()` get their file, instead of `LinkComponent` from next/link.
- Next on Windows: Turbopack source maps write the drive letter in lower case (`c:/`); source paths are project-relative again instead of absolute.
- Tokens declared in source CSS but absent at runtime are read too, with `var()` and simple `calc()` resolved: Tailwind 4 `@theme inline` (`--radius-xl: calc(var(--radius) + 4px)`) no longer makes 14px "off the scale".
- Button styles are rated high only when five or more styles include at least two from components other than the main one; many styles of one shared component (its variant and size props) are medium, and the summary says how many come from it.
- Near-duplicate pairs (buttons and cards) are looked for only between different components: two sizes of one `Button` are its API. In next-shadcn-admin-dashboard this removed 16 of 17 button pairs and kept `Button` vs `DropdownMenuTrigger`.

## 0.5.1 — 2026-10-24

- Listed in the official MCP Registry as `io.github.baccaraaa/tavero` (`mcpName` in `package.json`, `server.json`).

## 0.5.0 — 2026-10-23

- `tavero ui --export <dir>`: a static, read-only copy of the panel for the latest scan (plain HTML, crops and fonts included).
- The panel is in English and built on the design tokens it shares with the website; crops carry their size, fonts are preloaded, so nothing shifts while a page loads; source paths wrap at folder boundaries.
- Attribution walks through library server components: an element rendered by `next/link` inside a server `Button` is credited to `Button`.
- A button's rendered height is no longer part of its style signature, so the same style at two heights is one variant.
- `demo/acme`: a small Vite dashboard with deliberate drift, used for the website's demo and tests.
- `site/`: the taveroui.com website (Next.js static export): landing, docs, demo and the site's own audit (`npm run site:build`, `npm run site:audit`).

## 0.4.0 — 2026-10-23

- Every button and card style variant is cropped once per width (`crops/variants/<id>/<width>.png`); variant evidence and the panel's canonical picker show the variant's own picture.
- Canonical variants can be named in the panel ("primary", "ghost"); `expected` and `context` use the names: `DashButton "primary" (bg #2d4deb, …)`.
- Browser-default colors on unstyled elements (`#f0f0f0` button face, `#0000ee` links, …) that no source writes are one info finding, not off-palette.
- `expected` for a color prefers a close token from the family its files already use (`--ds-*`, `--lp-*`) and says why; the static scan records token references per file (`static.json` `tokenRefs`).
- The panel serves files as `/files/<scan>/<path>`, so crops kept by a partial rescan load.

## 0.3.0 — 2026-10-23

- `tavero ui`: local web panel on 127.0.0.1 to triage findings — filters, keyboard (↑↓, 1 fix, 2 accepted, 3 canonical, 4 note, Esc clear), crops at every width, component catalog, tokens, scans with diff, a notice when an agent wrote a new scan.
- Human decisions in `.tavero/decisions.json`: fix (listed first), accepted (hidden; comes back when the finding grows), canonical variant with allowed alternatives (other variants get it as `expected`, `context` names it), note to the agent. Applied at read time by the CLI, MCP, `context` and `report.html`.
- `tavero findings --all/--decision`; `tavero_findings` `includeAccepted`/`decision`; `tavero_finding` carries `decision`.

## 0.2.0 — 2026-10-22

- `tavero mcp`: MCP server on stdio with nine tools (`tavero_context`, `tavero_findings`, `tavero_finding`, `tavero_components`, `tavero_component`, `tavero_show`, `tavero_tokens`, `tavero_diff`, `tavero_scan`). Scans stream progress, run one at a time, can be cancelled, and keep a dev server they launched for later rescans.
- `tavero mcp --print-config <client>` for Claude Code, Cursor, Codex, Gemini CLI, Antigravity, VS Code and Windsurf.
- `docs/AGENTS.snippet.md` replaces `docs/CLAUDE.snippet.md`.
- `tavero diff --json` is compact (id, severity, rule, title per finding) and carries `note`; `tavero scan --json` adds `scan`, `diff`, `unauthenticatedRoutes`; `tavero tokens` pages with `--limit/--page`.
- Scan folders get millisecond names; a dev server launched by Tavero logs to `.tavero/devserver.log`.

## 0.1.0 — 2026-10-22

First packaged release.

- `tavero scan`: crawls a Vite or Next dev server at three viewports, attributes every element to its React component and file:line (React 19 dev fiber data, Turbopack source maps, DevTools-hook uncap), collects tokens, colors and scales, writes crops.
- Rules `buttons`, `cards` (preliminary), `colors`, `scales` with stable finding ids.
- Agent loop: `findings`, `finding`, partial rescan with `--routes` and `--rules`, `diff`, `context`.
- `tavero report`: self-contained HTML report in the scan directory.
- `SKILL.md` and `docs/CLAUDE.snippet.md` for Claude Code and Cursor.
- Tested on Windows and Linux (CI) against a mini Vite app and a mini Next 16 app.
