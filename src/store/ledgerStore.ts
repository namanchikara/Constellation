import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { ledgerDir, entityIds, indexPath } from './paths.js';
import {
  readFrontmatterFile,
  writeFrontmatterFile,
  type FrontmatterFile,
} from '../fs/frontmatterFile.js';
import {
  parseLedgerEntry,
  type LedgerFrontmatter,
} from '../domain/ledger.js';
import { renderIndex } from './indexer.js';

function ledgerPath(root: string, name: string): string {
  return join(ledgerDir(root), `${name}.md`);
}

export function listLedgerNames(root: string): string[] {
  return entityIds(ledgerDir(root));
}

export function readLedgerEntry(root: string, name: string): FrontmatterFile<LedgerFrontmatter> {
  return parseLedgerEntry(readFrontmatterFile<unknown>(ledgerPath(root, name)));
}

export function writeLedgerEntry(root: string, entry: FrontmatterFile<LedgerFrontmatter>): void {
  writeFrontmatterFile(ledgerPath(root, entry.data.name), entry);
}

export function regenerateLedgerIndex(root: string): string {
  const rows = listLedgerNames(root).map((name) => {
    const entry = readLedgerEntry(root, name);
    const marker = entry.data.polarity === 'positive' ? '(+)' : '(-)';
    return { sortKey: name, line: `${name} ${marker} — ${entry.data.description}` };
  });
  const content = renderIndex('Ledger', rows);
  writeFileSync(indexPath(ledgerDir(root)), content, 'utf8');
  return content;
}
