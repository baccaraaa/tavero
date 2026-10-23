import { Hero } from './components/Hero';
import { Counter } from './components/Counter';
export default function Home() {
  return (
    <main style={{ padding: 24 }}>
      <Hero title="Mini Next" />
      <Counter />
      <div className="card"><h2>Raw card</h2><p>Server component markup</p></div>
      <button className="raw" style={{ padding: '4px 10px', background: '#ee5544', color: '#fff', border: 'none', borderRadius: 4 }}>Raw button</button>
      <a href="/about">about</a>
    </main>
  );
}
