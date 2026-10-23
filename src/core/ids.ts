import { createHash } from 'node:crypto';

export function hashId(prefix: string, input: string): string {
  return `${prefix}_${createHash('sha1').update(input).digest('hex').slice(0, 10)}`;
}

export function componentId(file: string | null, name: string): string {
  return hashId('c', `${file ?? '?'}#${name}`);
}

export function instanceId(route: string, viewport: string, componentId: string, ordinal: number): string {
  return hashId('i', `${route}|${viewport}|${componentId}|${ordinal}`);
}

export function routeSlug(route: string): string {
  if (route === '/') return 'root';
  const s = route.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');
  return s || 'root';
}
