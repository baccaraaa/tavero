import type { Metadata } from 'next';
import { SITE } from './site';
import { DOCS } from './docs';

// rendered by scripts/gen-og.ts; a page's own openGraph replaces the root one, so every page names it
const IMAGE = { url: '/opengraph-image.png', width: 1200, height: 630, alt: 'Tavero: keep the UI your agent writes consistent' };

/** Title, description, canonical URL and link-preview text and image for one page. */
export function pageMeta(o: { title?: string; description: string; path: string }): Metadata {
  const url = SITE.url + o.path;
  const title = o.title ? `${o.title} · Tavero` : SITE.title;
  return {
    ...(o.title ? { title: o.title } : {}),
    description: o.description,
    alternates: { canonical: url },
    openGraph: { title, description: o.description, url, siteName: 'Tavero', type: 'website', images: [IMAGE] },
    twitter: { card: 'summary_large_image', title, description: o.description, images: [IMAGE.url] },
  };
}

export function docMeta(slug: (typeof DOCS)[number]['slug']): Metadata {
  const d = DOCS.find((x) => x.slug === slug)!;
  return pageMeta({ title: d.title, description: d.description, path: `/docs/${slug}/` });
}
