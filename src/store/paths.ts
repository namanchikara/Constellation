import { join } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';

export function boardDir(root: string): string {
  return join(root, '.constellation', 'board');
}
export function plansDir(root: string): string {
  return join(root, '.constellation', 'plans');
}
export function ledgerDir(root: string): string {
  return join(root, '.constellation', 'ledger');
}
export function cardPath(root: string, id: string): string {
  return join(boardDir(root), `${id}.md`);
}
export function indexPath(dir: string): string {
  return join(dir, '_index.md');
}
export function entityIds(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
    .map((f) => f.replace(/\.md$/, ''));
}
