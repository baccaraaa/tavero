import { forwardRef, type ReactNode } from 'react';
export const PillButton = forwardRef<HTMLButtonElement, { children: ReactNode }>(function PillButton({ children }, ref) {
  return <button ref={ref} className="pill"><span className="pill-dot" style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: '#fff', marginRight: 6 }} />{children}</button>;
});
