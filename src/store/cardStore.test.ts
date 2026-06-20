import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listCardIds, readCard, createCard, moveCardInStore } from './cardStore.js';

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'cnst-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('cardStore', () => {
  it('creates a card with a sequential id and persists it', () => {
    const card = createCard(root, { story: 'Export CSV', acceptanceCriteria: ['has headers'] });
    expect(card.data.id).toBe('0001-export-csv');
    expect(readCard(root, '0001-export-csv').data.state).toBe('backlog');
  });

  it('increments ids across creates', () => {
    createCard(root, { story: 'First', acceptanceCriteria: [] });
    const second = createCard(root, { story: 'Second', acceptanceCriteria: [] });
    expect(second.data.id).toBe('0002-second');
    expect(listCardIds(root).sort()).toEqual(['0001-first', '0002-second']);
  });

  it('moves a card through legal states and persists assignee', () => {
    const card = createCard(root, { story: 'Work', acceptanceCriteria: [] });
    moveCardInStore(root, card.data.id, 'todo');
    const moved = moveCardInStore(root, card.data.id, 'in-progress');
    expect(moved.data.state).toBe('in-progress');
    expect(moved.data.assignee).toBe('maker');
    expect(readCard(root, card.data.id).data.assignee).toBe('maker');
  });

  it('throws on an illegal move', () => {
    const card = createCard(root, { story: 'Work', acceptanceCriteria: [] });
    expect(() => moveCardInStore(root, card.data.id, 'done')).toThrow(/illegal transition/);
  });

  it('returns an empty list when the board does not exist', () => {
    expect(listCardIds(root)).toEqual([]);
  });

  it('excludes _index.md from the card list', () => {
    createCard(root, { story: 'Real card', acceptanceCriteria: [] });
    // simulate an index file present in the board dir
    writeFileSync(join(root, '.constellation', 'board', '_index.md'), '# Board\n');
    expect(listCardIds(root)).toEqual(['0001-real-card']);
  });

  it('throws when reading a card that does not exist', () => {
    expect(() => readCard(root, '9999-missing')).toThrow();
  });
});
