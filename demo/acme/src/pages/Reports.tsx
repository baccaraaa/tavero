import { Card } from '../components/Card';
import { TONES } from '../tones';
const METRICS = [['Delivered on time', '82%', 'green'], ['Blocked tasks', '9', 'amber'], ['Design reviews', '23', 'violet']] as const;
export function Reports() {
  return (
    <>
      <div className="page-head"><h1>Reports</h1><button className="pill">Download CSV</button></div>
      <div className="tiles">{METRICS.map(([label, value, tone]) => <div className="tile" key={label} style={TONES[tone]}><strong>{value}</strong>{label}</div>)}</div>
      <Card title="This quarter"><div className="row"><span>Projects shipped</span><span>3</span></div><div className="row"><span>Average cycle time</span><span>11 days</span></div></Card>
    </>
  );
}
