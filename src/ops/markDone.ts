import type { FrontmatterFile } from '../fs/frontmatterFile.js';
import type { CardFrontmatter } from '../domain/card.js';
import type { LedgerFrontmatter } from '../domain/ledger.js';
import { readCard, moveCardInStore } from '../store/cardStore.js';
import { writeLedgerEntry, regenerateLedgerIndex } from '../store/ledgerStore.js';
import { regenerateCardIndex } from '../store/indexer.js';
import { projectDone, type DoneInput } from '../domain/projectDone.js';

export function markDone(
  root: string,
  id: string,
  input: DoneInput,
): { card: FrontmatterFile<CardFrontmatter>; entry: FrontmatterFile<LedgerFrontmatter> } {
  const entry = projectDone(readCard(root, id), input);
  const card = moveCardInStore(root, id, 'done');
  writeLedgerEntry(root, entry);
  regenerateCardIndex(root);
  regenerateLedgerIndex(root);
  return { card, entry };
}
