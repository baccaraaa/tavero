import type { Img } from '@/lib/data';

/** A real crop from the demo scan (1x), shown at its natural size or scaled down to `max` px high, never up. */
export function Crop({ img, alt, max = 44 }: { img: Img | null; alt: string; max?: number }) {
  if (!img) return <span className="text-meta text-ink-3">no crop</span>;
  const h = Math.min(max, img.h);
  const w = Math.round((img.w / img.h) * h);
  return <img src={img.src} alt={alt} width={w} height={h} loading="lazy" decoding="async" className="block max-w-full" style={{ height: h, width: 'auto' }} />;
}
