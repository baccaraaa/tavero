# Contributing

Thanks for looking. Issues and pull requests are welcome.

## Reporting a problem

A useful report says what Tavero printed and what you expected, plus:

- the Tavero version (`npx tavero --version`), Node version and OS;
- the stack: Vite or Next (and version), React version, Tailwind or plain CSS;
- the finding id and `npx tavero finding <id> --json` when a finding looks wrong.

Please do not attach screenshots or crops of an app you are not allowed to share.

## Working on the code

```bash
npm ci
npx playwright install chromium
npm test          # unit tests and Playwright runtime tests against the apps in test/apps and demo/acme
npm run typecheck
npm run build
```

- Every change comes with a test: unit tests in `test/unit`, tests that need a browser in `test/runtime`.
- Finding ids are stable across scans (`hashId` of rule and key); a change to a rule's key changes ids and should say so in `CHANGELOG.md`.
- The CLI, the MCP server and the panel are thin layers over `src/core`; put logic there.
- Outputs are read by agents: keep text compact, paginated, and the same between CLI and MCP.

## The website

The site in `site/` must pass its own audit: `npm run site:install && npm run site:build && npm run site:audit` (Tavero on the site with 0 high and medium findings, Lighthouse 95 or more, axe, no horizontal scroll at 375, 768 and 1440).

## License

By contributing you agree that your contribution is licensed under the MIT license of this repository.
