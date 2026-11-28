/** App mark: three rail lines (red, purple, green) meeting at an interchange, on a light ground. */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect x="0.5" y="0.5" width="31" height="31" rx="7.5" fill="#fff" stroke="#d8dde0" />
      <path
        d="M6 24 C 11 14, 21 14, 26 8"
        fill="none"
        stroke="#E0262F"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path d="M6 16 H 26" fill="none" stroke="#8E2D9E" strokeWidth="3" strokeLinecap="round" />
      <path
        d="M10 6 C 14 14, 18 18, 24 26"
        fill="none"
        stroke="#7AC231"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="16" cy="16" r="3.6" fill="#fff" stroke="#17202A" strokeWidth="2" />
    </svg>
  );
}
