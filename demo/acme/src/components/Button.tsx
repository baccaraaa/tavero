import type { ReactNode } from 'react';
type Variant = 'primary' | 'secondary' | 'ghost';
export function Button({ variant = 'primary', onClick, children }: { variant?: Variant; onClick?: () => void; children: ReactNode }) {
  return <button className={`btn btn-${variant}`} onClick={onClick}>{children}</button>;
}
