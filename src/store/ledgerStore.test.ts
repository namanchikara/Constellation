import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildLedgerEntry } from '../domain/ledger.js';
import {
  writeLedgerEntry,
  readLedgerEntry,
  listLedgerNames,
  regenerateLedgerIndex,
} from './ledgerStore.js';

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'cnst-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('ledger', () => {
  it('builds an entry with the achievement triple in the body', () => {
    const entry = buildLedgerEntry({
      name: 'csv-export-shipped',
      description: 'csv export works; read when touching export',
      polarity: 'positive',
      card: '0007-export-csv',
      achievement: 'report exports to CSV, verified',
      purpose: 'analysts share data with non-users',
      proof: 'acceptance criteria pass + critic verdict',
    });
    expect(entry.data.polarity).toBe('positive');
    expect(entry.content).toContain('**Achievement:** report exports to CSV, verified');
    expect(entry.content).toContain('**Purpose:** analysts share data with non-users');
    expect(entry.content).toContain('**Proof:** acceptance criteria pass + critic verdict');
  });

  it('persists and re-reads an entry', () => {
    const entry = buildLedgerEntry({
      name: 'n1',
      description: 'd',
      polarity: 'negative',
      achievement: 'a',
      purpose: 'p',
      proof: 'pr',
    });
    writeLedgerEntry(root, entry);
    expect(readLedgerEntry(root, 'n1').data.polarity).toBe('negative');
    expect(listLedgerNames(root)).toEqual(['n1']);
  });

  it('indexes entries with polarity marker and description', () => {
    writeLedgerEntry(
      root,
      buildLedgerEntry({
        name: 'n1',
        description: 'a useful fact',
        polarity: 'positive',
        achievement: 'a',
        purpose: 'p',
        proof: 'pr',
      }),
    );
    const content = regenerateLedgerIndex(root);
    expect(content).toContain('n1');
    expect(content).toContain('(+)');
    expect(content).toContain('a useful fact');
  });
});
