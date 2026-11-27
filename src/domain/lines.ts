export const LINE_IDS = ['red', 'purple', 'green', 'M1', 'M2', 'M3'] as const;
export type LineId = (typeof LINE_IDS)[number];

export interface LineInfo {
  readonly name: string;
  readonly color: string;
  readonly metro: boolean;
}

export const LINES: Readonly<Record<LineId, LineInfo>> = {
  red: { name: 'הקו האדום', color: '#E0262F', metro: false },
  purple: { name: 'הקו הסגול', color: '#8E2D9E', metro: false },
  green: { name: 'הקו הירוק', color: '#7AC231', metro: false },
  M1: { name: 'מטרו M1', color: '#0B66C2', metro: true },
  M2: { name: 'מטרו M2', color: '#F07D1A', metro: true },
  M3: { name: 'מטרו M3', color: '#F2C200', metro: true },
};

export function isLineId(v: unknown): v is LineId {
  return LINE_IDS.some((id) => id === v);
}

/** Map layers the user can toggle: the six lines plus Israel Railways. */
export type LayerId = LineId | 'rail';
