import type { BrowserContext } from 'playwright';

/**
 * React dev builds capture a real JSX call-site stack only for the first 10 000
 * elements created per render pass (ReactSharedInternals.recentlyCreatedOwnerStacks),
 * then substitute a shared "UnknownOwner" placeholder. react-dom hands the internals
 * object to the DevTools hook's inject() before the first render; pinning the counter
 * to 0 there makes every element carry a real stack.
 */
export const UNCAP_SOURCE = `(() => {
  const hook = {
    supportsFiber: true, renderers: new Map(),
    on() {}, off() {}, emit() {}, sub() { return () => {}; },
    onCommitFiberRoot() {}, onCommitFiberUnmount() {}, onPostCommitFiberRoot() {}, checkDCE() {},
    inject(renderer) {
      const id = this.renderers.size + 1; this.renderers.set(id, renderer);
      try {
        const si = renderer.currentDispatcherRef;
        if (si && typeof si === 'object' && 'recentlyCreatedOwnerStacks' in si) {
          Object.defineProperty(si, 'recentlyCreatedOwnerStacks', { get: () => 0, set() {}, configurable: true });
          window.__taveroUncapped = (window.__taveroUncapped || 0) + 1;
        }
      } catch {}
      return id;
    },
  };
  Object.defineProperty(window, '__REACT_DEVTOOLS_GLOBAL_HOOK__', { value: hook, configurable: true, writable: false });
})();`;

export async function installUncap(context: BrowserContext): Promise<void> {
  await context.addInitScript(UNCAP_SOURCE);
}
