import type { FrontmatterFile } from '../fs/frontmatterFile.js';
import type { CardFrontmatter } from './card.js';
import { buildLedgerEntry, type LedgerFrontmatter } from './ledger.js';

export interface DoneInput {
  achievement: string;
  proof: string;
  polarity?: 'positive' | 'negative';
  description?: string;
}

function storyOf(content: string): string {
  const lines = content.split('\n');
  const idx = lines.findIndex((l) => l.trim() === '## Story');
  if (idx === -1) return '';
  for (let i = idx + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) break;
    if (lines[i].trim() !== '') return lines[i].trim();
  }
  return '';
}

export function projectDone(
  card: FrontmatterFile<CardFrontmatter>,
  input: DoneInput,
): FrontmatterFile<LedgerFrontmatter> {
  const purpose = storyOf(card.content);
  return buildLedgerEntry({
    name: `${card.data.id}-achievement`,
    description: input.description ?? input.achievement,
    polarity: input.polarity ?? 'positive',
    card: card.data.id,
    achievement: input.achievement,
    purpose,
    proof: input.proof,
  });
}
