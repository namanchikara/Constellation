import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { plansDir, entityIds, indexPath } from './paths.js';
import {
  readFrontmatterFile,
  writeFrontmatterFile,
  type FrontmatterFile,
} from '../fs/frontmatterFile.js';
import { buildPlan, parsePlan, type PlanFrontmatter } from '../domain/plan.js';
import { nextId } from '../domain/ids.js';
import { renderIndex } from './indexer.js';

function planPath(root: string, id: string): string {
  return join(plansDir(root), `${id}.md`);
}

export function listPlanIds(root: string): string[] {
  return entityIds(plansDir(root));
}

export function readPlan(root: string, id: string): FrontmatterFile<PlanFrontmatter> {
  return parsePlan(readFrontmatterFile<unknown>(planPath(root, id)));
}

export function createPlan(root: string, input: { problem: string }): FrontmatterFile<PlanFrontmatter> {
  const id = nextId(listPlanIds(root), input.problem);
  const plan = buildPlan({ id, problem: input.problem });
  writeFrontmatterFile(planPath(root, id), plan);
  return plan;
}

export function regeneratePlanIndex(root: string): string {
  const rows = listPlanIds(root).map((id) => {
    const plan = readPlan(root, id);
    return { sortKey: id, line: `${id} [${plan.data.status}] — ${plan.data.problem}` };
  });
  const content = renderIndex('Plans', rows);
  writeFileSync(indexPath(plansDir(root)), content, 'utf8');
  return content;
}
