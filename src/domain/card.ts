import { z } from 'zod';
import type { FrontmatterFile } from '../fs/frontmatterFile.js';

export const CARD_STATES = ['backlog', 'todo', 'in-progress', 'in-testing', 'done', 'wont-do'] as const;
export type CardState = (typeof CARD_STATES)[number];

export const ASSIGNEES = ['scout', 'maker', 'critic', 'human'] as const;
export type Assignee = (typeof ASSIGNEES)[number];

export const GRAVITIES = ['low', 'normal', 'high'] as const;
export type Gravity = (typeof GRAVITIES)[number];

export const CardFrontmatter = z.object({
  id: z.string(),
  state: z.enum(CARD_STATES),
  assignee: z.enum(ASSIGNEES),
  priority: z.number().int().optional(),
  gravity: z.enum(GRAVITIES).default('normal'),
  plan: z.string().optional(),
  blocked_by: z.array(z.string()).default([]),
});
export type CardFrontmatter = z.infer<typeof CardFrontmatter>;

const TRANSITIONS: Record<CardState, CardState[]> = {
  'backlog': ['todo', 'wont-do'],
  'todo': ['in-progress', 'backlog', 'wont-do'],
  'in-progress': ['in-testing', 'todo', 'wont-do'],
  'in-testing': ['done', 'in-progress', 'wont-do'],
  'done': [],
  'wont-do': [],
};

export function canTransition(from: CardState, to: CardState): boolean {
  return TRANSITIONS[from].includes(to);
}

const ASSIGNEE_BY_STATE: Record<CardState, Assignee> = {
  'backlog': 'scout',
  'todo': 'scout',
  'in-progress': 'maker',
  'in-testing': 'critic',
  'done': 'human',
  'wont-do': 'human',
};

export function assigneeForState(state: CardState): Assignee {
  return ASSIGNEE_BY_STATE[state];
}

export function appendLog(content: string, line: string): string {
  const bullet = `- ${line}`;
  const lines = content.split('\n');
  const logIdx = lines.findIndex((l) => l.trim() === '## Log');
  if (logIdx === -1) {
    return `${content.trim()}\n\n## Log\n${bullet}`;
  }
  let sectionEnd = lines.length;
  for (let i = logIdx + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) {
      sectionEnd = i;
      break;
    }
  }
  let insertAt = sectionEnd - 1;
  while (insertAt > logIdx && lines[insertAt].trim() === '') insertAt--;
  lines.splice(insertAt + 1, 0, bullet);
  return lines.join('\n');
}

export interface BuildCardInput {
  id: string;
  story: string;
  acceptanceCriteria: string[];
  plan?: string;
  gravity?: Gravity;
}

export function buildCard(input: BuildCardInput): FrontmatterFile<CardFrontmatter> {
  const data = CardFrontmatter.parse({
    id: input.id,
    state: 'backlog',
    assignee: 'scout',
    gravity: input.gravity ?? 'normal',
    plan: input.plan,
    blocked_by: [],
  });
  const criteria = input.acceptanceCriteria.map((c) => `- [ ] ${c}`).join('\n');
  const content = [
    '## Story',
    input.story,
    '',
    '## Acceptance criteria',
    criteria,
    '',
    '## Log',
    '- created → backlog (scout)',
    '',
    '## Achievement',
  ].join('\n');
  return { data, content };
}

export function moveCard(
  card: FrontmatterFile<CardFrontmatter>,
  to: CardState,
): FrontmatterFile<CardFrontmatter> {
  if (!canTransition(card.data.state, to)) {
    throw new Error(`illegal transition ${card.data.state} → ${to}`);
  }
  const assignee = assigneeForState(to);
  const content = appendLog(card.content, `${card.data.state} → ${to} (${assignee})`);
  return { data: { ...card.data, state: to, assignee }, content };
}

export function parseCard(file: FrontmatterFile<unknown>): FrontmatterFile<CardFrontmatter> {
  return { data: CardFrontmatter.parse(file.data), content: file.content };
}
