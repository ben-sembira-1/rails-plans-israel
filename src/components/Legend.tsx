import type { JSX } from 'react'

import type { Line } from '../data/schema.ts'

export function Legend({ lines }: { lines: readonly Line[] }): JSX.Element {
  return (
    <section className="legend" aria-label="Legend">
      <ul className="legend__lines">
        {lines.map((line) => (
          <li key={line.id}>
            <span className="legend__swatch" style={{ background: line.color }} />
            {line.name}
          </li>
        ))}
      </ul>
      <ul className="legend__status">
        <li>
          <span className="legend__sample legend__sample--operational" /> Operational
        </li>
        <li>
          <span className="legend__sample legend__sample--construction" /> Under construction
        </li>
        <li>
          <span className="legend__sample legend__sample--work-area" /> Closed work area (active)
        </li>
        <li>
          <span className="legend__sample legend__sample--planned" /> Planned (not yet started)
        </li>
      </ul>
    </section>
  )
}
