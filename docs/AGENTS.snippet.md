## UI consistency (Tavero)
- Before adding or changing UI, call `tavero_context` (CLI: `tavero context`) and reuse the components and tokens it names.
- After UI changes, call `tavero_scan` with the changed `routes`, then `tavero_findings` (CLI: `tavero scan --url <dev url> --routes …`, `tavero findings`).
- Work through findings with `tavero_finding`; its `expected` field is the token or component to use.
- Close a finding with a partial `tavero_scan` (`routes` + `rules`) and `tavero_diff`; it is done when listed as resolved.
- Never write under `.tavero/`; if pages land on a login screen, ask a human to run `tavero login`.
- Full guidance: `node_modules/tavero/SKILL.md`.
