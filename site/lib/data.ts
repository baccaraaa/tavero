// Everything on the landing page comes from a real scan of demo/acme and from the tool itself (npm run site:gen).
import demoJson from '@/generated/demo.json';
import referenceJson from '@/generated/reference.json';
import transcriptJson from '@/content/transcript.json';

export interface Img { src: string; w: number; h: number }
export interface DemoRow { crop: Img | null; component: string; where: string; uses: number; signature: string; canonical: 'primary' | 'allowed' | null; name: string | null }
export interface Demo {
  scannedAt: string; pages: number; routes: number; widths: number; components: number;
  findings: { high: number; medium: number; info: number };
  buttons: { id: string; title: string; variants: number; rows: DemoRow[]; expected: string };
  cards: { title: string; crops: Img[] };
  panel: Img & { src1x: string };
  color: { hex: string; where: string; expected: string } | null;
  radius: { used: string[]; declared: string[] };
  canonical: string;
}
export interface Reference {
  cli: Array<{ command: string; help: string }>;
  tools: Array<{ name: string; title: string; description: string; params: string[] }>;
  configs: Array<{ client: string; file: string; text: string }>;
  global: string;
}
export interface Transcript { lines: Array<{ kind: 'call' | 'out' | 'ok' | 'note'; text: string }>; seconds: number; turns: number; model: string }

export const demo = demoJson as Demo;
export const reference = referenceJson as Reference;
export const transcript = transcriptJson as Transcript;

export const CLIENT_NAMES: Record<string, string> = { claude: 'Claude Code', cursor: 'Cursor', codex: 'Codex', gemini: 'Gemini CLI', antigravity: 'Antigravity', vscode: 'VS Code', windsurf: 'Windsurf' };
