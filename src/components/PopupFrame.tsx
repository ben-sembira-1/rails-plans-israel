/** The common frame of every map popup: a color swatch and title, the body, and where the data comes from. */
export function PopupFrame({
  title,
  swatch,
  hollow = false,
  subtitle,
  source,
  className,
  children,
}: {
  title: string;
  /** The color of what was clicked (its line or layer). */
  swatch?: string;
  /** A ring instead of a filled swatch (e.g. a permit outline). */
  hollow?: boolean;
  subtitle?: React.ReactNode;
  source?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={className ? `pop ${className}` : 'pop'}>
      <div className="pop-head">
        {swatch !== undefined && (
          <span
            className="pop-swatch"
            style={hollow ? { borderColor: swatch } : { background: swatch, borderColor: swatch }}
            aria-hidden="true"
          />
        )}
        <b dir="auto">{title}</b>
      </div>
      {subtitle !== undefined && <div className="pop-sub">{subtitle}</div>}
      {children}
      {source !== undefined && <div className="pop-source">{source}</div>}
    </div>
  );
}

/** A small tag for values that are estimates, not published facts. */
export function Estimated({ children }: { children: React.ReactNode }) {
  return <span className="est">{children}</span>;
}
