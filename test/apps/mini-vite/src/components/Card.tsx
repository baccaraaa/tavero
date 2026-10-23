import type { ReactNode } from 'react';
export const Card = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="card"><h2>{title}</h2>{children}</section>
);
