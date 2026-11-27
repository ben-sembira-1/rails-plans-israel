/** App mark: three converging rail lines (red, purple, green) over a deep navy tile. */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1f3a8a" />
          <stop offset="1" stopColor="#0b1530" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#logo-bg)" />
      <path
        d="M6 24 C 11 14, 21 14, 26 8"
        fill="none"
        stroke="#E0262F"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path d="M6 16 H 26" fill="none" stroke="#B45CC8" strokeWidth="3" strokeLinecap="round" />
      <path
        d="M10 6 C 14 14, 18 18, 24 26"
        fill="none"
        stroke="#7AC231"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="16" cy="16" r="3.2" fill="#fff" />
    </svg>
  );
}
