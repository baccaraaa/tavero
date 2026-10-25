// Tavero in-page collector. Evaluated by Playwright as a string: `(${source})(opts)`.
// Rules: no imports, no references outside this function, ES2020 only.
(opts) => {
  const fiberKeyOf = (el) => { for (const k in el) { if (k.startsWith('__reactFiber$')) return k; } return null; };
  const nameOf = (type) => {
    if (!type || typeof type === 'string') return null;
    if (typeof type === 'function') return type.displayName || type.name || null;
    if (typeof type === 'object') {
      if (typeof type.displayName === 'string') return type.displayName;
      if (type.render) return nameOf(type.render);
      if (type.type) return nameOf(type.type);
    }
    return null;
  };
  const INTERNAL_FN = /^(exports\.(jsxDEV|jsx|jsxs|createElement)|jsxDEV|UnknownOwner|fakeJSXCallSite|initializeElement|Object\.react_stack_bottom_frame|renderWithHooks|renderWithHooksAgain|beginWork|performUnitOfWork|workLoop\w*|runWithFiberInDEV|updateFunctionComponent|updateForwardRef|updateMemoComponent|mountIndeterminateComponent|performWorkUntilDeadline|flushWork|__require)/;
  const parseStack = (err) => {
    const stack = err && err.stack;
    if (!stack) return null;
    const frames = [];
    for (const line of String(stack).split('\n')) {
      const m = line.match(/^\s*at\s+(?:(.*?)\s+\()?((?:https?|file):\/\/[^\s)]+?):(\d+):(\d+)\)?\s*$/);
      if (!m) continue;
      const fn = m[1] || null;
      if (fn && INTERNAL_FN.test(fn)) continue;
      frames.push({ fn, loc: m[2] + ':' + m[3] + ':' + m[4] });
      if (frames.length >= opts.maxFrames) break;
    }
    return frames;
  };
  const ids = new Map();
  let nextId = 1;
  const idOf = (fiber) => {
    let id = ids.get(fiber) || (fiber.alternate && ids.get(fiber.alternate));
    if (!id) { id = nextId++; ids.set(fiber, id); }
    return id;
  };
  const owners = {};
  const ownerEntry = (o) => {
    const id = idOf(o);
    if (!owners[id]) {
      const props = o.memoizedProps && typeof o.memoizedProps === 'object' ? Object.keys(o.memoizedProps).filter((k) => k !== 'children') : [];
      owners[id] = { name: nameOf(o.type), frames: parseStack(o._debugStack), props };
    }
    return id;
  };

  // tokens: custom properties declared on root/theme selectors in same-origin stylesheets
  const tokens = [];
  const seenTok = new Set();
  const ROOT_SEL = /(^|[\s,>])(:root|html|\.dark|\.light|\[data-theme[^\]]*\])(\s*[,{.:\[]|\s|$)/;
  const walkRules = (rules, href) => {
    for (const rule of Array.from(rules)) {
      if (rule.cssRules && !rule.selectorText) { walkRules(rule.cssRules, href); continue; }
      if (!rule.selectorText || !ROOT_SEL.test(rule.selectorText)) continue;
      for (let i = 0; i < rule.style.length; i++) {
        const prop = rule.style[i];
        if (!prop.startsWith('--')) continue;
        const key = prop + '@' + rule.selectorText;
        if (seenTok.has(key)) continue;
        seenTok.add(key);
        tokens.push({ name: prop, value: rule.style.getPropertyValue(prop).trim(), selector: rule.selectorText, href });
      }
    }
  };
  for (const sheet of Array.from(document.styleSheets)) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; }
    walkRules(rules, sheet.href);
  }
  const tokenValues = {};
  const rootStyle = getComputedStyle(document.documentElement);
  for (const t of tokens) if (!(t.name in tokenValues)) tokenValues[t.name] = rootStyle.getPropertyValue(t.name).trim();

  const links = Array.from(document.querySelectorAll('a[href]')).map((a) => a.href).filter((h) => h.startsWith(location.origin));
  const hasPasswordInput = !!document.querySelector('input[type=password]');
  let nextBuildError = null;
  const portal = document.querySelector('nextjs-portal');
  if (portal && portal.shadowRoot) {
    const txt = portal.shadowRoot.textContent || '';
    if (/Build Error|Module not found|Failed to compile/.test(txt)) nextBuildError = txt.replace(/\s+/g, ' ').slice(0, 500);
  }

  const sx = window.scrollX, sy = window.scrollY;
  // visible text only: chart libraries inject <style> into elements, and textContent would include it
  const textOf = (root) => {
    let out = '';
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement && n.parentElement.closest('style, script, noscript, template') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    for (let n = walker.nextNode(); n && out.length < 200; n = walker.nextNode()) out += n.nodeValue;
    return out.trim().slice(0, 60);
  };
  const result = {
    url: location.href,
    viewport: [innerWidth, innerHeight],
    docSize: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
    reactDetected: false,
    elements: [],
    owners,
    tokens,
    tokenValues,
    links: [...new Set(links)],
    hasPasswordInput,
    nextBuildError,
    pageBg: pageBackground(),
  };
  // the page background: body, else html, else white
  function pageBackground() {
    for (const node of [document.body, document.documentElement]) {
      const bg = node ? getComputedStyle(node).backgroundColor : '';
      if (bg && bg !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(bg)) return bg;
    }
    return 'rgb(255, 255, 255)';
  }
  // a stable key per element (child indexes from body), to match an element between the light and dark render
  const keyCache = new Map();
  const indexCache = new Map();
  function domKey(el) {
    if (el === document.body || !el.parentElement) return '';
    const hit = keyCache.get(el);
    if (hit !== undefined) return hit;
    const parent = el.parentElement;
    let idx = indexCache.get(parent);
    if (!idx) { idx = new Map(); let i = 0; for (const c of parent.children) idx.set(c, i++); indexCache.set(parent, idx); }
    const key = domKey(parent) + '.' + idx.get(el);
    keyCache.set(el, key);
    return key;
  }
  const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'link', 'meta', 'template', 'svg', 'path']);
  // overlay = any ancestor up to body that is fixed/sticky or a dialog (cookie banners, modals, sticky headers)
  const overlayCache = new Map();
  const inOverlayOf = (node) => {
    let p = node.parentElement;
    const chain = [];
    let hit = false;
    while (p && p !== document.body) {
      if (overlayCache.has(p)) { hit = overlayCache.get(p); break; }
      chain.push(p);
      const pos = getComputedStyle(p).position;
      if (p.getAttribute('role') === 'dialog' || pos === 'fixed' || pos === 'sticky') { hit = true; break; }
      p = p.parentElement;
    }
    for (const c of chain) overlayCache.set(c, hit);
    return hit;
  };
  for (const el of document.body.getElementsByTagName('*')) {
    const tag = el.tagName.toLowerCase();
    if (SKIP_TAGS.has(tag)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) < 0.05) continue;
    const k = fiberKeyOf(el);
    const f = k ? el[k] : null;
    if (f) result.reactDetected = true;
    // server components (RSC): React lists them outer→inner in _debugInfo on the subtree root, and host elements
    // they render carry the innermost one as a plain component-info owner ({ name, env }) instead of a fiber
    const si = f && Array.isArray(f._debugInfo) ? f._debugInfo.filter((i) => i && i.name).map((i) => (i.env ? i.name + '@' + i.env : i.name)) : [];
    const oc = [];
    let o = f ? f._debugOwner : null;
    while (o && oc.length < opts.maxOwners) {
      if (o.tag === undefined) {
        // a server component info; its `owner` links lead to the server components around it (next/link's
        // LinkComponent → the app's Button → the page), so collect them outer→inner like _debugInfo
        if (!si.length) for (let ci = o; ci && ci.name && si.length < opts.maxOwners; ci = ci.owner) si.unshift(ci.env ? ci.name + '@' + ci.env : ci.name);
        break;
      }
      oc.push(ownerEntry(o));
      o = o._debugOwner;
    }
    const styles = {};
    for (const p of opts.styleProps) styles[p] = cs.getPropertyValue(p);
    const parent = el.parentElement;
    const interactiveAncestor = parent ? parent.closest('button, a, input, select, textarea, [role="button"], [role="dialog"]') : null;
    const navAncestor = parent ? parent.closest('nav, aside, [role="navigation"], [role="menu"], [role="menubar"], [role="tablist"], [role="listbox"], [data-slot="sidebar"], [data-sidebar="sidebar"]') : null;
    result.elements.push({
      role: el.getAttribute('role'),
      type: el.getAttribute('type'),
      inInteractive: !!interactiveAncestor,
      inNav: !!navAncestor,
      inOverlay: inOverlayOf(el),
      t: tag,
      dk: domKey(el),
      f: !!f,
      sf: f ? parseStack(f._debugStack) : null,
      oc,
      si,
      r: [Math.round(r.x + sx), Math.round(r.y + sy), Math.round(r.width), Math.round(r.height)],
      text: el.childElementCount <= 3 ? textOf(el) : '',
      styles,
      children: el.childElementCount,
      parentBg: parent ? getComputedStyle(parent).backgroundColor : null,
    });
  }
  return result;
}
