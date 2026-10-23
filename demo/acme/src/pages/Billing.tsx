import { Card } from '../components/Card';
import { invoices } from '../data';
export function Billing() {
  return (
    <>
      <div className="page-head"><h1>Billing</h1></div>
      <Card title="Plan">
        <div className="row"><div><div className="plan-name">Team</div><div className="plan-price">$480 per month · 4 seats</div><div className="plan-note">Renews on Nov 1</div></div><button className="upgrade">Upgrade plan</button></div>
      </Card>
      <Card title="Invoices">{invoices.map((i) => <div className="row" key={i.id}><span>{i.id}</span><span className="muted">{i.date}</span><span>{i.amount}</span></div>)}</Card>
    </>
  );
}
