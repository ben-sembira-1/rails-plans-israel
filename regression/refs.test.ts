// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { pickBaselines } from './refs.ts';

const day = (d: number) => new Date(Date.UTC(2026, 10, d));

describe('pickBaselines', () => {
  const tags = [
    { name: 'v0.1.0', date: day(19) },
    { name: 'v0.2.0', date: day(27) },
    { name: 'v0.3.1', date: day(27) },
    { name: 'v0.3.0', date: day(27) },
    { name: 'v0.4.1', date: day(27) },
    { name: 'v0.4.0', date: day(27) },
    { name: 'reference-update-2026/11/19', date: day(19) },
  ];

  it('picks the latest, the previous minor and the release from a week ago', () => {
    expect(pickBaselines(tags, day(27))).toEqual([
      { role: 'latest', title: 'Latest release', tag: 'v0.4.1' },
      { role: 'previous-minor', title: 'Previous minor version', tag: 'v0.3.1' },
      { role: 'week-ago', title: 'Release from a week ago', tag: 'v0.1.0' },
    ]);
  });

  it('skips a week-ago release when every release is newer', () => {
    expect(pickBaselines(tags, day(25)).map((b) => b.role)).toEqual(['latest', 'previous-minor']);
  });

  it('compares versions numerically and crosses major versions', () => {
    const picked = pickBaselines(
      [
        { name: 'v1.10.0', date: day(27) },
        { name: 'v1.9.3', date: day(27) },
        { name: 'v0.12.0', date: day(27) },
      ],
      day(27),
    );
    expect(picked.map((b) => b.tag)).toEqual(['v1.10.0', 'v1.9.3']);
    expect(
      pickBaselines(
        [
          { name: 'v1.0.0', date: day(27) },
          { name: 'v0.9.0', date: day(27) },
        ],
        day(27),
      )[1]?.tag,
    ).toBe('v0.9.0');
  });

  it('is empty without release tags', () => {
    expect(pickBaselines([{ name: 'foo', date: day(1) }], day(27))).toEqual([]);
  });
});
