import type { ReactElement } from 'react';
import { Sidebar } from './components/Sidebar';
import { Overview } from './pages/Overview';
import { Projects } from './pages/Projects';
import { Billing } from './pages/Billing';
import { Team } from './pages/Team';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';

const PAGES: Record<string, () => ReactElement> = { '/': Overview, '/projects': Projects, '/billing': Billing, '/team': Team, '/reports': Reports, '/settings': Settings };

export function App() {
  const path = location.pathname.replace(/\/$/, '') || '/';
  const Page = PAGES[path] ?? Overview;
  return <div className="shell"><Sidebar path={path} /><main className="content"><Page /></main></div>;
}
