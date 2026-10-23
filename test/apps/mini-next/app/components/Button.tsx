'use client';
const styles = {
  primary: { background: 'var(--color-brand)', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px' },
  ghost: { background: 'transparent', color: '#3366ff', border: '1px solid #3366ff', borderRadius: 8, padding: '6px 12px' },
} as const;
export function Button({ variant, onClick, children }: { variant: keyof typeof styles; onClick?: () => void; children: React.ReactNode }) {
  return <button style={styles[variant]} onClick={onClick}>{children}</button>;
}
