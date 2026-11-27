// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { compareSemver, latestVersion, packageVersion, parseSemver } from './version.ts';

describe('version helper', () => {
  it('parses X.Y.Z with or without a leading v', () => {
    expect(parseSemver('v1.2.3')).toEqual([1, 2, 3]);
    expect(parseSemver('0.10.0')).toEqual([0, 10, 0]);
    expect(parseSemver('reference-update-2026/11/19')).toBeNull();
    expect(parseSemver('v1.2')).toBeNull();
  });

  it('compares numerically, not lexically', () => {
    expect(compareSemver([0, 10, 0], [0, 9, 9])).toBe(1);
    expect(compareSemver([1, 0, 0], [1, 0, 0])).toBe(0);
    expect(compareSemver([1, 0, 0], [1, 0, 1])).toBe(-1);
  });

  it('finds the latest release tag and ignores other tags', () => {
    expect(latestVersion(['v0.1.0', 'v0.10.0', 'v0.9.0', 'reference-update-2026/11/19', ''])).toEqual([
      0, 10, 0,
    ]);
    expect(latestVersion([])).toBeNull();
  });

  it('reads a valid package.json version', () => {
    expect(parseSemver(packageVersion())).not.toBeNull();
  });
});
