import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { StatTile } from '../components/StatTile';
import { activity } from '../data';
export function Overview() {
  return (
    <>
      <div className="page-head"><h1>Overview</h1><Button variant="secondary">Export</Button><Button>New project</Button></div>
      <div className="stats">
        <StatTile label="Active projects" value="6" hint="2 due this month" />
        <StatTile label="Open tasks" value="148" hint="31 closed this week" />
        <StatTile label="Team" value="4" hint="1 invite pending" />
      </div>
      <Card title="Recent activity">{activity.map((a) => <div className="row" key={a}><span>{a}</span><span className="muted">today</span></div>)}</Card>
    </>
  );
}
