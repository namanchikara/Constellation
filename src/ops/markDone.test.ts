import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCard, moveCardInStore, readCard } from '../store/cardStore.js';
import { readLedgerEntry, listLedgerNames } from '../store/ledgerStore.js';
import { markDone } from './markDone.js';

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'cnst-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function intoTesting(): string {
  const c = createCard(root, {
    story: 'As an analyst I want CSV export so that I can share data',
    acceptanceCriteria: ['has headers'],
  });
  moveCardInStore(root, c.data.id, 'todo');
  moveCardInStore(root, c.data.id, 'in-progress');
  moveCardInStore(root, c.data.id, 'in-testing');
  return c.data.id;
}

describe('markDone', () => {
  it('moves the card to done and writes a projected ledger entry', () => {
    const id = intoTesting();
    const { card, entry } = markDone(root, id, {
      achievement: 'CSV export works',
      proof: 'criteria pass + critic verdict',
    });
    expect(card.data.state).toBe('done');
    expect(readCard(root, id).data.state).toBe('done');
    expect(entry.data.card).toBe(id);
    expect(entry.data.polarity).toBe('positive');
    expect(entry.content).toContain('**Purpose:** As an analyst I want CSV export so that I can share data');
    expect(entry.content).toContain('**Achievement:** CSV export works');
    expect(entry.content).toContain('**Proof:** criteria pass + critic verdict');
    expect(readLedgerEntry(root, entry.data.name).data.card).toBe(id);
    expect(listLedgerNames(root)).toHaveLength(1);
  });

  it('refuses to mark done a card that is not in testing', () => {
    const c = createCard(root, { story: 'x', acceptanceCriteria: [] });
    expect(() => markDone(root, c.data.id, { achievement: 'a', proof: 'p' })).toThrow(
      /illegal transition/,
    );
  });

  it('supports negative-polarity (dead-end) achievements', () => {
    const id = intoTesting();
    const { entry } = markDone(root, id, {
      achievement: 'approach X is a dead end',
      proof: 'benchmarked, 10x too slow',
      polarity: 'negative',
    });
    expect(entry.data.polarity).toBe('negative');
  });
});
