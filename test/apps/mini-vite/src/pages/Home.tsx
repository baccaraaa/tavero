import { Button } from '../components/Button';
import { PillButton } from '../components/PillButton';
import { Card } from '../components/Card';
export function Home() {
  return (
    <main style={{ padding: 24 }}>
      {localStorage.getItem('mini-auth') && <p className="who">signed in</p>}
      <h1>Mini app</h1>
      <Card title="First card"><p>Body one</p><Button variant="primary" onClick={() => {}}>Save</Button></Card>
      <Card title="Second card"><p>Body two</p><Button variant="ghost" onClick={() => {}}>Cancel</Button></Card>
      <Button variant="danger" onClick={() => {}}>Delete</Button>
      <PillButton>Pill</PillButton>
      <button className="raw" style={{ padding: '4px 10px' }}>Raw button</button>
      <div className="raw-card"><h2>Raw card</h2><p>Not a component</p></div>
      <a href="/many">many</a>
      <div className="banner" style={{ position: 'fixed', bottom: 12, left: 12, padding: '4px 8px', background: '#fff' }}>
        <span>We use cookies</span> <Button variant="primary" onClick={() => {}}>Accept</Button>
      </div>
    </main>
  );
}
