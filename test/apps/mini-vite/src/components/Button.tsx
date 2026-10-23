import type { ReactNode } from 'react';
export function Button({ variant, onClick, children }: { variant: 'primary' | 'ghost' | 'danger'; onClick: () => void; children: ReactNode }) {
  return <button className={`btn btn-${variant}`} onClick={onClick}>{children}</button>;
}
