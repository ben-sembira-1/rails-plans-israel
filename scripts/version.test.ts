// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  bumpSemver,
  compareSemver,
  isBumpLevel,
  latestVersion,
  packageVersion,
  parseSemver,
  targetVersion,
} from './version.ts';

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

  it('bumps patch, minor and major', () => {
    expect(bumpSemver([0, 6, 1], 'patch')).toEqual([0, 6, 2]);
    expect(bumpSemver([0, 6, 1], 'minor')).toEqual([0, 7, 0]);
    expect(bumpSemver([0, 6, 1], 'major')).toEqual([1, 0, 0]);
  });

  it('accepts only patch, minor and major as levels', () => {
    expect(['patch', 'minor', 'major', 'Patch', '', undefined].map(isBumpLevel)).toEqual([
      true,
      true,
      true,
      false,
      false,
      false,
    ]);
  });

  it('bumps from the newer of master and the latest tag', () => {
    expect(targetVersion([0, 6, 1], [0, 6, 1], 'minor')).toEqual([0, 7, 0]);
    // master ahead of the tag (a release still deploying): bump master's version
    expect(targetVersion([0, 7, 0], [0, 6, 1], 'patch')).toEqual([0, 7, 1]);
    // tag ahead of master's package.json: bump the tag
    expect(targetVersion([0, 5, 0], [0, 6, 1], 'patch')).toEqual([0, 6, 2]);
    expect(targetVersion(null, null, 'patch')).toEqual([0, 0, 1]);
  });
});
