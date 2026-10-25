import type { AttributedElement, AttributedInstance, RawFrame, RawPage, ResolvedLoc } from '../core/types.js';
import type { ComponentIndex } from '../static/componentIndex.js';
import type { Resolver } from './sourcemaps.js';

const fmt = (r: ResolvedLoc | null): string | null => (r && r.path ? `${r.path}:${r.line}:${r.col}` : null);

type AppOwner = { name: string | null; key: string; loc: string | null; hops: number; via?: string; file: string | null; line: number | null; resolved: 'stack' | 'static' };

/**
 * Spec §9: own app frame → direct owner (hops 0); else the first owner whose own
 * call site is app code → its parent owner (hops n); else RSC name via the static
 * index; else none. Instances are keyed by the app owner fiber id.
 */
export async function attributePage(raw: RawPage, resolver: Resolver, index: ComponentIndex): Promise<{ elements: AttributedElement[]; instances: Map<string, AttributedInstance> }> {
  const owners = raw.owners;
  const locs = new Set<string>();
  for (const e of raw.elements) for (const f of e.sf ?? []) locs.add(f.loc);
  for (const o of Object.values(owners)) for (const f of o.frames ?? []) locs.add(f.loc);
  for (const loc of locs) await resolver.resolve(loc);
  const firstApp = (frames: RawFrame[] | null | undefined): { fr: RawFrame; r: ResolvedLoc } | null => {
    for (const fr of frames ?? []) { const r = resolver.cached(fr.loc); if (r?.app) return { fr, r }; }
    return null;
  };

  const instances = new Map<string, AttributedInstance>();
  const elements: AttributedElement[] = [];
  for (const e of raw.elements) {
    const directId = e.oc[0] !== undefined ? String(e.oc[0]) : null;
    const direct = directId ? owners[directId] : null;
    let app: AppOwner | null = null;
    const own = firstApp(e.sf);
    if (own && direct && directId) {
      // Clone patterns (Radix Slot / asChild): the JSX was written in app code, but a library
      // component owns the clone. Credit the authoring function, found by name in the owner chain.
      let name = direct.name ?? own.fr.fn;
      let key = directId;
      let via: string | undefined;
      // the authoring frame may be an anonymous callback (e.g. inside .map); take the first named app frame
      const authored = (e.sf ?? []).find((f) => f.fn && resolver.cached(f.loc)?.app)?.fn ?? null;
      if (authored && direct.name !== authored && !firstApp(direct.frames)) {
        const idx = e.oc.findIndex((id) => owners[String(id)]?.name === authored);
        key = idx > 0 ? String(e.oc[idx]) : `fn:${authored}`;
        name = authored;
        via = direct.name ?? undefined;
      }
      app = { name, key, loc: fmt(own.r), hops: 0, via, file: own.r.path, line: own.r.line, resolved: 'stack' };
    } else if (own && !direct) {
      app = { name: own.fr.fn ?? 'root', key: `root:${own.fr.fn ?? ''}`, loc: fmt(own.r), hops: 0, file: own.r.path, line: own.r.line, resolved: 'stack' };
    } else {
      for (let i = 0; i < e.oc.length; i++) {
        const o = owners[String(e.oc[i])];
        const hit = firstApp(o?.frames);
        if (!hit) continue;
        const parentId = e.oc[i + 1] !== undefined ? String(e.oc[i + 1]) : null;
        const parent = parentId ? owners[parentId] : null;
        // the app frame sits inside the parent's render, so it names the parent's defining file
        app = { name: parent?.name ?? hit.fr.fn ?? null, key: parentId ?? `fn:${hit.fr.fn}`, loc: fmt(hit.r), hops: i + 1, via: o?.name ?? undefined, file: hit.r.path, line: hit.r.line, resolved: 'stack' };
        break;
      }
    }
    if (!app && e.si.length) {
      // innermost first, past library server components (next/link's LinkComponent) that the app's index does not have
      const names = e.si.map((s) => s.replace(/@.*$/, ''));
      const nm = [...names].reverse().find((n) => index.get(n)?.length) ?? names[names.length - 1];
      const hit = index.get(nm)?.[0] ?? null;
      app = { name: nm, key: `rsc:${nm}`, loc: hit ? `${hit.file}:${hit.line}` : null, hops: 0, via: 'rsc', file: hit?.file ?? null, line: hit?.line ?? null, resolved: 'static' };
    }
    elements.push({ t: e.t, dk: e.dk, role: e.role, type: e.type, inInteractive: e.inInteractive, inNav: e.inNav, inOverlay: e.inOverlay, f: e.f, o: direct?.name ?? null, s: own ? fmt(own.r) : null, a: app?.name ?? null, al: app?.loc ?? null, ah: app?.hops ?? null, aid: app?.key ?? null, via: app?.via, si: e.si, r: e.r, styles: e.styles, children: e.children, parentBg: e.parentBg, text: e.text });
    if (!app?.name) continue;
    let inst = instances.get(app.key);
    if (!inst) {
      const self = owners[app.key];
      const used = self ? firstApp(self.frames) : null;
      inst = { key: app.key, name: app.name, file: app.file, line: app.line, resolved: app.file ? app.resolved : 'none', usedFrom: used ? fmt(used.r) : null, hosts: 0, rect: { x: e.r[0], y: e.r[1], w: e.r[2], h: e.r[3] }, props: self?.props ?? [] };
      instances.set(app.key, inst);
    }
    if (!inst.file && app.file) { inst.file = app.file; inst.line = app.line; inst.resolved = app.resolved; }
    inst.hosts++;
    const x2 = Math.max(inst.rect.x + inst.rect.w, e.r[0] + e.r[2]);
    const y2 = Math.max(inst.rect.y + inst.rect.h, e.r[1] + e.r[3]);
    inst.rect.x = Math.min(inst.rect.x, e.r[0]);
    inst.rect.y = Math.min(inst.rect.y, e.r[1]);
    inst.rect.w = x2 - inst.rect.x;
    inst.rect.h = y2 - inst.rect.y;
  }
  // components that only rendered library wrappers: file from their own call site
  for (const inst of instances.values()) {
    if (inst.file || !inst.usedFrom) continue;
    const m = inst.usedFrom.match(/^(.*):(\d+):\d+$/);
    if (m) { inst.file = m[1]; inst.line = Number(m[2]); inst.resolved = 'stack'; }
  }
  return { elements, instances };
}
