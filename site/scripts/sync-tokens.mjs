// design/tokens.css is the single source; the site gets a copy next to its styles before dev and build.
import { copyFileSync } from 'node:fs';
copyFileSync(new URL('../../design/tokens.css', import.meta.url), new URL('../app/tokens.css', import.meta.url));
