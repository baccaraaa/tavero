import createMDX from '@next/mdx';
// plugins by name: Turbopack cannot take functions in loader options
const withMDX = createMDX({ options: { remarkPlugins: ['remark-gfm'] } });
/** Static export: the whole site is files, hosted anywhere. */
export default withMDX({
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  pageExtensions: ['ts', 'tsx', 'mdx'],
  devIndicators: false,
  turbopack: { root: import.meta.dirname },
  // Next writes an AGENTS.md with its own rules into the app by default; the site does not need it
  agentRules: false,
});
