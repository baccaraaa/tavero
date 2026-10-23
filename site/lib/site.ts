/** Props for links that leave the site: a new tab, without giving the other page access to this one. */
export const EXTERNAL = { target: '_blank', rel: 'noopener noreferrer' } as const;

export const SITE = {
  name: 'Tavero',
  title: 'Tavero: UI consistency checks for React apps built with coding agents',
  url: 'https://taveroui.com',
  description: 'Tavero scans your running React app, finds drift in buttons, cards, colors and spacing, and gives your coding agent each fix with the file, the line and the token to use.',
  npm: 'https://www.npmjs.com/package/tavero',
  /** The public repository; the header and footer show the link when this is set. */
  github: 'https://github.com/baccaraaa/tavero' as string | null,
  nav: [
    { href: '/docs/quick-start/', label: 'Docs' },
    { href: '/demo/', label: 'Demo' },
  ],
};
