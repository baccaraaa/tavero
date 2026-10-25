export type Framework = 'vite' | 'next';

export interface ProjectInfo {
  dir: string;
  framework: Framework;
  srcRoots: string[]; // absolute
  tailwindConfig: string | null;
  cssEntries: string[]; // absolute
  devScript: string | null;
  packageJson: Record<string, unknown>;
}

export interface Viewport { name: string; width: number; height: number; theme?: 'dark' }

/** One element's colors, keyed by its DOM path, for comparing the light and the dark render of a page. */
export interface ThemeProbe { k: string; bg: string | null; fg: string | null; pbg: string | null; a: number; c: string | null; f: string | null }
export const DEFAULT_VIEWPORTS: Viewport[] = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
];

export type TokenKind = 'color' | 'radius' | 'spacing' | 'font-size' | 'font-weight' | 'font-family' | 'shadow' | 'other';
export type TokenSource = { file: string; line: number } | { source: 'runtime' | 'tailwind-default' };
export interface Token { id: string; name: string; kind: TokenKind; value: string; resolved: string; theme: 'light'; source: TokenSource }

export type Resolved = 'stack' | 'static' | 'none';
export interface Component {
  id: string;
  name: string;
  file: string | null;
  line: number | null;
  resolved: Resolved;
  instances: number;
  pages: string[];
  props: string[];
}

export interface Rect { x: number; y: number; w: number; h: number }
export interface Instance { id: string; componentId: string; route: string; viewport: string; rect: Rect; hosts: number; crop?: string }

export type RouteSource = 'cli' | 'routes.json' | 'next' | 'react-router' | 'tanstack-router' | 'crawl';
export type RouteStatus = 'pending' | 'ok' | 'failed' | 'unauthenticated' | 'no-react' | 'skipped';
export interface RouteEntry { path: string; source: RouteSource; status: RouteStatus; reason?: string }

export interface ScanMeta {
  version: string;
  createdAt: string;
  url: string;
  project: { dir: string; framework: Framework };
  viewports: Viewport[];
  /** extra theme passes, e.g. ['dark'] */
  themes?: string[];
  routes: RouteEntry[];
  stats: { pages: number; components: number; instances: number; tokens: number; unresolvedComponents: number; findings: { high: number; medium: number; info: number } };
  warnings: string[];
  stale: boolean;
  staleRoutes: string[];
  rescannedRoutes: string[];
  rulesRun: RuleName[];
  diff: { from: string; new: number; resolved: number; unchanged: number; note: string | null } | null;
}

export interface DiffResult {
  from: string;
  to: string;
  findings: { new: Finding[]; resolved: Finding[]; unchanged: Array<{ id: string; title: string; statsChanged: Record<string, [number, number]> }> };
  components: { added: Component[]; removed: Component[] };
}

export type Role = 'button-text' | 'button-icon' | 'card';

export interface NormalizedStyles {
  bg: string | null;
  color: string | null;
  borderWidth: number;
  borderStyle: string;
  borderColor: string | null;
  radius: [number, number, number, number];
  paddingY: number;
  paddingX: number;
  padding: [number, number, number, number];
  gap: number;
  fontSize: number;
  fontWeight: number;
  lineHeight: number | null;
  fontFamily: string;
  shadow: string;
  height: number;
  display: string;
  position: string;
}

// ---- static layer ----
export interface TailwindTheme { colors: Record<string, string>; radius: string[]; spacing: string[]; fontSize: string[]; shadow: string[] }
export interface StaticInfo {
  tailwind: { version: 3 | 4 | null; theme: TailwindTheme | null };
  hardcodedColors: Record<string, Array<{ file: string; line: number }>>;
  /** token names each source file references via var(--…); absent in scans before 0.3.1 */
  tokenRefs?: Record<string, string[]>;
  warnings: string[];
}

// ---- derived per-page data ----
export interface StyleSample {
  id: string;
  route: string;
  viewport: string;
  role: Role;
  componentId: string | null;
  componentName: string | null;
  file: string | null;
  line: number | null;
  hops: number | null;
  rect: Rect;
  text: string;
  styles: NormalizedStyles;
  parentBg: string | null;
  children: number;
  nested: boolean;
  inOverlay: boolean;
  /** crop of this sample's style variant at this width, set for the first sample of each variant and width */
  crop?: string;
}
export interface CountExample { route: string; viewport: string; component: string | null; file: string | null }
export interface CountEntry { count: number; examples: CountExample[] }
export interface ColorEntry { bg: number; color: number; border: number; examples: CountExample[] }
export type ColorCounts = Record<string, ColorEntry>;
export type ScaleProp = 'radius' | 'padding' | 'gap' | 'fontSize' | 'fontWeight' | 'shadow';
export const SCALE_PROPS: ScaleProp[] = ['radius', 'padding', 'gap', 'fontSize', 'fontWeight', 'shadow'];
export type ScaleCounts = Record<ScaleProp | 'typography', Record<string, CountEntry>>;
export interface PageInstance extends Instance { key: string; name: string; file: string | null; line: number | null; resolved: Resolved; props: string[] }
export interface PageRecord {
  route: string;
  viewport: string;
  status: RouteStatus;
  reason?: string;
  docSize: [number, number];
  crawledAt: string;
  links: string[];
  instances: PageInstance[];
  samples: StyleSample[];
  colors: ColorCounts;
  scales: ScaleCounts;
  tokens?: { decls: RawTokenDecl[]; values: Record<string, string> };
  /** set on the dark-theme pass */
  theme?: 'dark';
  /** the page background (body, else html) */
  pageBg?: string | null;
  /** element colors for the light/dark comparison: on the widest light pass and the dark pass */
  probe?: ThemeProbe[];
  /** token values as the dark theme computes them */
  darkTokens?: Record<string, string>;
}

// ---- rules and findings ----
export type RuleName = 'buttons' | 'cards' | 'colors' | 'scales';
export type Severity = 'high' | 'medium' | 'info';
export interface Evidence {
  route?: string;
  viewport?: string;
  componentId?: string | null;
  component?: string | null;
  file?: string | null;
  line?: number | null;
  value: string;
  expected?: string;
  crop?: string;
  sampleId?: string;
  variantId?: string;
  canonical?: 'primary' | 'allowed';
}
export interface DecisionView { status: 'fix' | 'accepted' | 'reopened' | 'resolved' | null; reason?: string; note?: string; canonical?: { primary: string; allowed: string[]; names?: Record<string, string> } }
export interface Finding {
  id: string;
  rule: RuleName;
  key: string;
  severity: Severity;
  title: string;
  summary: string;
  stats: Record<string, number>;
  evidence: Evidence[];
  preliminary?: boolean;
  status?: 'new' | 'resolved' | 'unchanged';
  decision?: DecisionView;
}
export interface RuleInput {
  samples: StyleSample[];
  colors: ColorCounts;
  scales: ScaleCounts;
  tokens: Token[];
  staticInfo: StaticInfo;
  instances: Instance[];
  components: Component[];
}

// ---- raw page data as produced by inspect.browser.js ----
export interface RawFrame { fn: string | null; loc: string }
export interface RawOwner { name: string | null; frames: RawFrame[] | null; props: string[] }
export interface RawElement {
  t: string;
  /** DOM path key, see ThemeProbe */
  dk?: string;
  role: string | null;
  type: string | null;
  inInteractive: boolean;
  inNav: boolean;
  inOverlay: boolean;
  f: boolean;
  sf: RawFrame[] | null;
  oc: number[];
  si: string[];
  r: [number, number, number, number];
  text: string;
  styles: Record<string, string>;
  children: number;
  parentBg: string | null;
}
export interface RawTokenDecl { name: string; value: string; selector: string; href: string | null }
export interface RawPage {
  url: string;
  viewport: [number, number];
  docSize: [number, number];
  reactDetected: boolean;
  elements: RawElement[];
  owners: Record<string, RawOwner>;
  tokens: RawTokenDecl[];
  tokenValues: Record<string, string>;
  links: string[];
  hasPasswordInput: boolean;
  nextBuildError: string | null;
  pageBg?: string;
}

// ---- attribution output ----
export interface ResolvedLoc { raw: string; path: string | null; line: number | null; col: number | null; app: boolean }
export interface AttributedElement {
  t: string;
  dk?: string;
  role: string | null;
  type: string | null;
  inInteractive: boolean;
  inNav: boolean;
  inOverlay: boolean;
  f: boolean;
  o: string | null;
  s: string | null;
  a: string | null;
  al: string | null;
  ah: number | null;
  aid: string | null;
  via?: string;
  si: string[];
  r: [number, number, number, number];
  styles: Record<string, string>;
  children: number;
  parentBg: string | null;
  text: string;
}
export interface AttributedInstance {
  key: string;
  name: string;
  file: string | null;
  line: number | null;
  resolved: Resolved;
  usedFrom: string | null;
  hosts: number;
  rect: Rect;
  props: string[];
}
