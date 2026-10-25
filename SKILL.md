---
name: tavero
description: Audit a React app's UI consistency (buttons, cards, colors, scales) against its own design tokens, then fix findings in a scan → fix → rescan → diff loop. Use before writing new UI in an existing React project and when asked to unify components or colors.
---

# Tavero

Tavero attaches to a running Vite or Next dev server, maps every visible element to the React component and source line that rendered it, and reports drift as findings with stable ids, file:line locations and crop images. Every command prints a compact text table (20 rows by default, `--limit` up to 200) or JSON with `--json`. Tavero writes only to `<project>/.tavero/`.

## Setup (once per project)

1. Install: `npm i -D tavero && npx playwright install chromium` (or run with `npx tavero`).
2. Start the project's dev server yourself, or let Tavero start it (it runs `npm run dev` on the port in `--url`).
3. If the app needs a login, ask the human to run `tavero login --url http://localhost:5173/login` once; it opens a browser, they log in, and the session is saved for scans. Headless alternative when test credentials are known: `tavero login --url … --email … --password …`.

Run every command from the project directory, or pass `--dir <project>`.

## MCP tools (preferred when available)

If your client has the Tavero MCP server (`tavero mcp`), use its tools instead of the shell:

| Tool | Use |
|---|---|
| `tavero_context` | design-system brief; call before writing UI |
| `tavero_findings` | list problems (filter `rule`, `severity`; `limit`/`page`) |
| `tavero_finding` | one problem with evidence and `expected`; its `next` field gives the exact rescan call |
| `tavero_scan` | scan the running app; after a fix pass only `routes` and `rules` |
| `tavero_diff` | resolved / new / unchanged since the previous scan |
| `tavero_components`, `tavero_component`, `tavero_show`, `tavero_tokens` | inventory, crop image paths, tokens |

Loop: `tavero_context` → `tavero_findings` → `tavero_finding` → edit the code → `tavero_scan` (routes + rules) → `tavero_diff`. Login stays a human step: `tavero login` in a terminal.

Connect the server with `npx tavero mcp --print-config <client>`; it prints the config for claude, cursor, codex, gemini, antigravity, vscode or windsurf and writes nothing.

The CLI commands below do the same through a shell.

## Before writing new UI

```
tavero context
```

Read the brief (about 1500 tokens): the stack, the tokens, the canonical button/card components with their files and props, the dominant radius/spacing/typography, and the open problems. Reuse the canonical components and tokens it names. Pass `--budget 800` when context is tight.

## Audit

```
tavero scan --url http://localhost:5173           # all routes, three viewports; minutes
tavero scan --url … --routes /dashboard,/settings  # only these routes
tavero findings                                    # id · severity · rule · title · evidence count
tavero findings --rule colors --severity high
tavero finding <id>                                # evidence with file:line, current value, expected token, crop path
tavero components | tavero component Button | tavero show Button --viewport mobile | tavero tokens
tavero report                                      # HTML report in the scan directory for the human
```

Rules: `buttons` (distinct button styles, near pairs, raw `<button>`s), `cards` (preliminary), `colors` (off-palette, Tailwind defaults, near pairs, hardcoded literals; in a dark theme, `dark:*` findings for backgrounds and text that do not switch), `scales` (radius/padding/gap/font/shadow off the declared scale).

## Fix loop

1. `tavero finding <id>` and open the files in its evidence.
2. Change the code: use the token or canonical component the finding names as `expected`.
3. Rescan only what you touched: `tavero scan --url … --routes /dashboard --rules colors` (seconds). Findings from routes you did not rescan are carried over unchanged.
4. `tavero diff` shows new / resolved / unchanged findings by id. A finding is closed when it appears under "resolved". After a partial rescan the diff says which stale routes may still carry the finding; run a full scan to confirm.

## Interpreting findings

- A human may triage findings in the panel (`tavero ui`, which the human runs): `decision.status: fix` is confirmed work, do those first; findings marked accepted are hidden (list them with `includeAccepted` or `tavero findings --all` only when asked); on button and card variants `expected` names the canonical the human chose; read `decision.note`. Never edit `.tavero/decisions.json` yourself.

- `expected` names the nearest token or the canonical component; prefer it over inventing a value.
- A finding with many evidence rows is usually one shared style; fix the component, not every call site.
- `cards` is preliminary: card detection is heuristic, use it as a hint.
- Components "without file" come from pages where source maps were not served; rerun with the dev server in a clean state.

## Do not

- Do not edit anything under `.tavero/`.
- Do not run `tavero login` headlessly with a human's real password; ask them to log in in the browser.
- Do not treat Tailwind default colors as tokens in a project that declares its own palette.
