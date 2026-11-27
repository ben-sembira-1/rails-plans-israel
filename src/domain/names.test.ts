import { describe, expect, it } from 'vitest';
import { shortName } from './names.ts';

describe('shortName', () => {
  it('drops the line from section and site names', () => {
    expect(shortName('הסגול – אלנבי והעלייה')).toBe('אלנבי והעלייה');
    expect(shortName('הקו האדום – הארכה לראשון לציון')).toBe('הארכה לראשון לציון');
    expect(shortName('אתר M2 – תחנת הבימה')).toBe('אתר תחנת הבימה');
    expect(shortName('רחוב בלי קו')).toBe('רחוב בלי קו');
  });
});
