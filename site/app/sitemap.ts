import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';
import { DOCS, docHref } from '@/lib/docs';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ['/', '/docs/', ...DOCS.map((d) => docHref(d.slug)), '/demo/', '/audit/'];
  return paths.map((p) => ({ url: SITE.url + p }));
}
