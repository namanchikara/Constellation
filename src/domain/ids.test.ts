import { describe, it, expect } from 'vitest';
import { slugify, nextId } from './ids.js';

describe('ids', () => {
  it('slugifies titles', () => {
    expect(slugify('Export report as CSV!')).toBe('export-report-as-csv');
  });

  it('starts at 0001 when there are no ids', () => {
    expect(nextId([], 'First card')).toBe('0001-first-card');
  });

  it('increments the max sequence number', () => {
    expect(nextId(['0001-a', '0007-b', '0003-c'], 'New')).toBe('0008-new');
  });

  it('ignores malformed ids when computing the max', () => {
    expect(nextId(['_index', 'garbage', '0002-x'], 'New')).toBe('0003-new');
  });

  it('ignores ids whose prefix is not exactly four digits', () => {
    expect(nextId(['0007abc-foo', '0002-x'], 'New')).toBe('0003-new');
  });
});
