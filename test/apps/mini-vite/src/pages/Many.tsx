const items = Array.from({ length: 11000 }, (_, i) => i);
export function Many() {
  return <div className="many">{items.map((i) => <span key={i} className="cell">{i}</span>)}</div>;
}
