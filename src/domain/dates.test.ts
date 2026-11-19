import { dateSpecToTime, formatDateSpec, toIsoDate } from './dates.ts'

describe('dateSpecToTime', () => {
  it.each([
    ['2027', 'start', '2027-01-01'],
    ['2027', 'end', '2027-12-31'],
    ['2027-Q2', 'start', '2027-04-01'],
    ['2027-Q2', 'end', '2027-06-30'],
    ['2027-02', 'end', '2027-02-28'],
    ['2028-02', 'end', '2028-02-29'],
    ['2027-11-19', 'start', '2027-11-19'],
    ['2027-11-19', 'end', '2027-11-19'],
  ] as const)('%s (%s) -> %s', (spec, bound, expected) => {
    expect(toIsoDate(dateSpecToTime(spec, bound))).toBe(expected)
  })

  it('end of a year is after the start of its last day', () => {
    expect(dateSpecToTime('2027', 'end')).toBeGreaterThan(dateSpecToTime('2027-12-31', 'start'))
  })
})

describe('formatDateSpec', () => {
  it.each([
    ['2027', '2027'],
    ['2027-Q3', 'Q3 2027'],
    ['2027-03', 'Mar 2027'],
    ['2027-03-05', '5 Mar 2027'],
  ])('%s -> %s', (spec, expected) => {
    expect(formatDateSpec(spec)).toBe(expected)
  })
})
