const LINKS = [['/', 'Overview'], ['/projects', 'Projects'], ['/billing', 'Billing'], ['/team', 'Team'], ['/reports', 'Reports'], ['/settings', 'Settings']] as const;
export function Sidebar({ path }: { path: string }) {
  return (
    <aside className="sidebar">
      <div className="logo">Acme</div>
      <nav>{LINKS.map(([href, label]) => <a key={href} href={href} className={href === path ? 'on' : ''}>{label}</a>)}</nav>
    </aside>
  );
}
