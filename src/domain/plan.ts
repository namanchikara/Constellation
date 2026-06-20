import { z } from 'zod';
import type { FrontmatterFile } from '../fs/frontmatterFile.js';

export const PlanFrontmatter = z.object({
  id: z.string(),
  status: z.enum(['active', 'superseded', 'done']).default('active'),
  problem: z.string(),
});
export type PlanFrontmatter = z.infer<typeof PlanFrontmatter>;

export interface BuildPlanInput {
  id: string;
  problem: string;
}

export function buildPlan(input: BuildPlanInput): FrontmatterFile<PlanFrontmatter> {
  const data = PlanFrontmatter.parse({ id: input.id, status: 'active', problem: input.problem });
  const content = [
    '## Verified problem',
    '_(Scout: the evidence this problem is real)_',
    '',
    '## Approach + rationale',
    '_(chosen approach; alternatives ruled out)_',
    '',
    '## Decomposition → cards',
    '_(list the step-work card ids)_',
    '',
    '## Revision log',
    '- created',
  ].join('\n');
  return { data, content };
}

export function parsePlan(file: FrontmatterFile<unknown>): FrontmatterFile<PlanFrontmatter> {
  return { data: PlanFrontmatter.parse(file.data), content: file.content };
}
