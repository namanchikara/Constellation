import { writeFileSync } from 'node:fs';
import { boardDir, indexPath } from './paths.js';
import { listCardIds, readCard } from './cardStore.js';

export interface IndexRow {
  sortKey: string;
  line: string;
}

export function renderIndex(title: string, rows: IndexRow[]): string {
  const sorted = [...rows].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  const body = sorted.map((r) => `- ${r.line}`).join('\n');
  return `# ${title}\n\n${body}\n`;
}

export function firstLineOfSection(content: string, heading: string): string {
  const lines = content.split('\n');
  const idx = lines.findIndex((l) => l.trim() === `## ${heading}`);
  if (idx === -1) return '';
  for (let i = idx + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) break;
    if (lines[i].trim() !== '') return lines[i].trim();
  }
  return '';
}

export function regenerateCardIndex(root: string): string {
  const rows: IndexRow[] = listCardIds(root).map((id) => {
    const card = readCard(root, id);
    const story = firstLineOfSection(card.content, 'Story');
    return {
      sortKey: id,
      line: `${id} [${card.data.state}] (${card.data.assignee}) — ${story}`,
    };
  });
  const content = renderIndex('Board', rows);
  writeFileSync(indexPath(boardDir(root)), content, 'utf8');
  return content;
}
