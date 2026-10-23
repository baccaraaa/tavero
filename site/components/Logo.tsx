/** The folded-paper T from temp/logo-1.jpg, traced into two paths. */
export function Logo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <path d="M14 22c1-3 4-5 8-6l20-4c4-1 7 2 5 5l-6 9c-1 2-3 3-5 3L16 32c-3 0-4-3-2-6z" fill="currentColor" />
      <path d="M33 31l-7 14c-1 2-1 4-1 6v4c0 3 3 4 5 3l7-4c3-2 4-6 4-9V29z" fill="currentColor" opacity=".72" />
    </svg>
  );
}
