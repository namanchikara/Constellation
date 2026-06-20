import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderIndex, firstLineOfSection, regenerateCardIndex } from './indexer.js';
import { createCard, moveCardInStore } from './cardStore.js';
import { indexPath, boardDir } from './paths.js';

describe('renderIndex', () => {
  it('sorts rows by sortKey and renders bullets under a title', () => {
    const out = renderIndex('Board', [
      { sortKey: '0002', line: 'b' },
      { sortKey: '0001', line: 'a' },
    ]);
    expect(out).toBe('# Board\n\n- a\n- b\n');
  });

  it('renders just the title when there are no rows', () => {
    expect(renderIndex('Board', [])).toBe('# Board\n');
  });
});

describe('firstLineOfSection', () => {
  it('returns the first non-empty line under a heading', () => {
    expect(firstLineOfSection('## Story\nHello world\n\n## Log', 'Story')).toBe('Hello world');
  });
  it('returns empty string when the heading is missing', () => {
    expect(firstLineOfSection('## Log\nx', 'Story')).toBe('');
  });
});

describe('regenerateCardIndex', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'cnst-'));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('lists each card with id, state, assignee and story summary', () => {
    const c = createCard(root, { story: 'Export CSV', acceptanceCriteria: [] });
    moveCardInStore(root, c.data.id, 'todo');
    const content = regenerateCardIndex(root);
    expect(content).toContain('0001-export-csv');
    expect(content).toContain('[todo]');
    expect(content).toContain('Export CSV');
    expect(readFileSync(indexPath(boardDir(root)), 'utf8')).toBe(content);
  });

  it('includes the assignee in the index line', () => {
    const c = createCard(root, { story: 'Export CSV', acceptanceCriteria: [] });
    const content = regenerateCardIndex(root);
    expect(content).toContain('(scout)');
  });
});
