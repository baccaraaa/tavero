import { Card } from '../components/Card';
import { members } from '../data';
export function Team() {
  return (
    <>
      <div className="page-head"><h1>Team</h1><button>Invite member</button></div>
      <Card title="Members">{members.map((m) => <div className="row" key={m.email}><span>{m.name}</span><span className="muted">{m.email}</span><span>{m.role}</span></div>)}</Card>
    </>
  );
}
