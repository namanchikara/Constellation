import { z } from 'zod';
import type { FrontmatterFile } from '../fs/frontmatterFile.js';

export const LedgerFrontmatter = z.object({
  name: z.string(),
  description: z.string(),
  polarity: z.enum(['positive', 'negative']),
  card: z.string().optional(),
});
export type LedgerFrontmatter = z.infer<typeof LedgerFrontmatter>;

export interface BuildLedgerInput {
  name: string;
  description: string;
  polarity: 'positive' | 'negative';
  card?: string;
  achievement: string;
  purpose: string;
  proof: string;
}

export function buildLedgerEntry(input: BuildLedgerInput): FrontmatterFile<LedgerFrontmatter> {
  const data = LedgerFrontmatter.parse({
    name: input.name,
    description: input.description,
    polarity: input.polarity,
    card: input.card,
  });
  const content = [
    `- **Achievement:** ${input.achievement}`,
    `- **Purpose:** ${input.purpose}`,
    `- **Proof:** ${input.proof}`,
  ].join('\n');
  return { data, content };
}

export function parseLedgerEntry(file: FrontmatterFile<unknown>): FrontmatterFile<LedgerFrontmatter> {
  return { data: LedgerFrontmatter.parse(file.data), content: file.content };
}
