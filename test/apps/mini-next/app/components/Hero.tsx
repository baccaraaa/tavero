export function Hero({ title }: { title: string }) {
  return <section className="hero" style={{ padding: 24 }}><h1>{title}</h1><p>Server-rendered hero</p></section>;
}
