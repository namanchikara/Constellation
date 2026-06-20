# Constellation Board Substrate — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a TypeScript CLI that is the durable data layer for Constellation's Kanban board — cards, plans, and the achievement ledger as Markdown+frontmatter files, with validated state transitions and Done→ledger projection.

**Architecture:** Pure domain logic (schemas, state machine, builders) with no I/O, wrapped by thin file-backed stores, wrapped by a `commander` CLI. State lives in a frontmatter `state` field; columns are views. One entity per file under `.constellation/{board,plans,ledger}/`; an `_index.md` per store is the only file an agent loads by default.

**Tech Stack:** Node ≥20, TypeScript ~5.5, vitest (tests), gray-matter (frontmatter), zod (schema validation), commander (CLI), tsx (run TS).

## Global Constraints

- **Language/runtime:** TypeScript, Node ≥20, ES modules (`"type": "module"`). Relative imports use the `.js` extension.
- **Storage convention:** one entity per file, Markdown + YAML frontmatter. `state` is a frontmatter field — entities move by rewriting the field, never by moving files.
- **IDs:** sequential 4-digit prefix + slug, e.g. `0007-export-csv`. No randomness, no timestamps.
- **Directories:** cards in `.constellation/board/`, plans in `.constellation/plans/`, ledger in `.constellation/ledger/`. Index file per store is `_index.md` (underscore prefix excludes it from entity listings).
- **Card states (exact):** `backlog | todo | in-progress | in-testing | done | wont-do`.
- **Assignees (exact):** `scout | maker | critic | human`.
- **Gravity (exact):** `low | normal | high`, default `normal`.
- **Done rule:** `done` is reachable only from `in-testing`. Moving to `done` projects an achievement-ledger entry.
- **Assignee by state:** backlog/todo→scout, in-progress→maker, in-testing→critic, done/wont-do→human.

---

### Task 1: Project scaffold + frontmatter file module

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`
- Create: `src/fs/frontmatterFile.ts`
- Test: `src/fs/frontmatterFile.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `interface FrontmatterFile<T> { data: T; content: string }`; `parseFrontmatter<T>(raw): FrontmatterFile<T>`; `serializeFrontmatter<T>(f): string`; `readFrontmatterFile<T>(path): FrontmatterFile<T>`; `writeFrontmatterFile<T>(path, f): void`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "constellation",
  "version": "0.1.0",
  "type": "module",
  "bin": { "constellation": "./dist/cli.js" },
  "scripts": {
    "test": "vitest run",
    "build": "tsc",
    "cli": "tsx src/cli.ts"
  },
  "dependencies": {
    "commander": "^12.1.0",
    "gray-matter": "^4.0.3",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "^5.5.4",
    "vitest": "^2.1.0",
    "@types/node": "^20.16.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["**/*.test.ts"]
}
```

- [ ] **Step 3: Create `vitest.config.ts` and `.gitignore`**

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['src/**/*.test.ts'] },
});
```

`.gitignore`:
```
node_modules/
dist/
```

- [ ] **Step 4: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, no errors.

- [ ] **Step 5: Write the failing test**

`src/fs/frontmatterFile.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parseFrontmatter,
  serializeFrontmatter,
  readFrontmatterFile,
  writeFrontmatterFile,
} from './frontmatterFile.js';

describe('frontmatterFile', () => {
  it('parses frontmatter and trims body', () => {
    const raw = '---\nid: x\n---\n\n## Body\nhello\n';
    const f = parseFrontmatter<{ id: string }>(raw);
    expect(f.data.id).toBe('x');
    expect(f.content).toBe('## Body\nhello');
  });

  it('round-trips through serialize → parse', () => {
    const file = { data: { id: 'x', state: 'backlog' }, content: '## Body\nhi' };
    const round = parseFrontmatter<typeof file.data>(serializeFrontmatter(file));
    expect(round.data).toEqual(file.data);
    expect(round.content).toBe('## Body\nhi');
  });

  it('writes then reads a file from disk', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cnst-'));
    try {
      const path = join(dir, 'nested', 'a.md');
      writeFrontmatterFile(path, { data: { id: 'a' }, content: 'body' });
      const back = readFrontmatterFile<{ id: string }>(path);
      expect(back.data.id).toBe('a');
      expect(back.content).toBe('body');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './frontmatterFile.js'`.

- [ ] **Step 7: Implement `src/fs/frontmatterFile.ts`**

```ts
import matter from 'gray-matter';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export interface FrontmatterFile<T> {
  data: T;
  content: string;
}

export function parseFrontmatter<T>(raw: string): FrontmatterFile<T> {
  const parsed = matter(raw);
  return { data: parsed.data as T, content: parsed.content.trim() };
}

export function serializeFrontmatter<T extends object>(file: FrontmatterFile<T>): string {
  return matter.stringify(`${file.content.trim()}\n`, file.data as Record<string, unknown>);
}

export function readFrontmatterFile<T>(path: string): FrontmatterFile<T> {
  return parseFrontmatter<T>(readFileSync(path, 'utf8'));
}

export function writeFrontmatterFile<T extends object>(path: string, file: FrontmatterFile<T>): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, serializeFrontmatter(file), 'utf8');
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npm test`
Expected: PASS (3 tests).

- [ ] **Step 9: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts .gitignore src/fs/
git commit -m "feat: project scaffold + frontmatter file module"
```

---

### Task 2: ID generation

**Files:**
- Create: `src/domain/ids.ts`
- Test: `src/domain/ids.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `slugify(text: string): string`; `nextId(existingIds: string[], title: string): string`.

- [ ] **Step 1: Write the failing test**

`src/domain/ids.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { slugify, nextId } from './ids.js';

describe('ids', () => {
  it('slugifies titles', () => {
    expect(slugify('Export report as CSV!')).toBe('export-report-as-csv');
  });

  it('starts at 0001 when there are no ids', () => {
    expect(nextId([], 'First card')).toBe('0001-first-card');
  });

  it('increments the max sequence number', () => {
    expect(nextId(['0001-a', '0007-b', '0003-c'], 'New')).toBe('0008-new');
  });

  it('ignores malformed ids when computing the max', () => {
    expect(nextId(['_index', 'garbage', '0002-x'], 'New')).toBe('0003-new');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test src/domain/ids.test.ts`
Expected: FAIL — `Cannot find module './ids.js'`.

- [ ] **Step 3: Implement `src/domain/ids.ts`**

```ts
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}

export function nextId(existingIds: string[], title: string): string {
  const max = existingIds
    .map((id) => parseInt(id.split('-')[0], 10))
    .filter((n) => !Number.isNaN(n))
    .reduce((acc, n) => Math.max(acc, n), 0);
  const seq = String(max + 1).padStart(4, '0');
  return `${seq}-${slugify(title)}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test src/domain/ids.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/ids.ts src/domain/ids.test.ts
git commit -m "feat: sequential+slug id generation"
```

---

### Task 3: Card domain — schema, state machine, builders

**Files:**
- Create: `src/domain/card.ts`
- Test: `src/domain/card.test.ts`

**Interfaces:**
- Consumes: `FrontmatterFile<T>` from `src/fs/frontmatterFile.ts`.
- Produces:
  - `CARD_STATES`, `type CardState`; `ASSIGNEES`, `type Assignee`; `GRAVITIES`, `type Gravity`.
  - `CardFrontmatter` (zod schema) and `type CardFrontmatter`.
  - `canTransition(from: CardState, to: CardState): boolean`.
  - `assigneeForState(state: CardState): Assignee`.
  - `appendLog(content: string, line: string): string`.
  - `interface BuildCardInput { id: string; story: string; acceptanceCriteria: string[]; plan?: string; gravity?: Gravity }`.
  - `buildCard(input: BuildCardInput): FrontmatterFile<CardFrontmatter>`.
  - `moveCard(card: FrontmatterFile<CardFrontmatter>, to: CardState): FrontmatterFile<CardFrontmatter>`.
  - `parseCard(file: FrontmatterFile<unknown>): FrontmatterFile<CardFrontmatter>`.

- [ ] **Step 1: Write the failing test**

`src/domain/card.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  canTransition,
  assigneeForState,
  appendLog,
  buildCard,
  moveCard,
  parseCard,
} from './card.js';

describe('card state machine', () => {
  it('allows backlog → todo but not backlog → done', () => {
    expect(canTransition('backlog', 'todo')).toBe(true);
    expect(canTransition('backlog', 'done')).toBe(false);
  });

  it('only allows done from in-testing', () => {
    expect(canTransition('in-testing', 'done')).toBe(true);
    expect(canTransition('in-progress', 'done')).toBe(false);
  });

  it('maps state to assignee', () => {
    expect(assigneeForState('in-progress')).toBe('maker');
    expect(assigneeForState('in-testing')).toBe('critic');
    expect(assigneeForState('todo')).toBe('scout');
  });
});

describe('appendLog', () => {
  it('appends a bullet under an existing Log section', () => {
    const out = appendLog('## Log\n- created\n\n## Achievement', 'todo → in-progress');
    expect(out).toContain('- created\n- todo → in-progress');
    expect(out.indexOf('## Achievement')).toBeGreaterThan(out.indexOf('todo → in-progress'));
  });

  it('creates a Log section when absent', () => {
    expect(appendLog('## Story\nhi', 'first')).toContain('## Log\n- first');
  });
});

describe('buildCard', () => {
  it('creates a backlog card assigned to scout with rendered criteria', () => {
    const card = buildCard({
      id: '0001-x',
      story: 'As a user I want X so that Y',
      acceptanceCriteria: ['does A', 'does B'],
      gravity: 'high',
    });
    expect(card.data.state).toBe('backlog');
    expect(card.data.assignee).toBe('scout');
    expect(card.data.gravity).toBe('high');
    expect(card.content).toContain('- [ ] does A');
    expect(card.content).toContain('As a user I want X so that Y');
  });

  it('defaults gravity to normal', () => {
    const card = buildCard({ id: '0001-x', story: 's', acceptanceCriteria: [] });
    expect(card.data.gravity).toBe('normal');
  });
});

describe('moveCard', () => {
  it('updates state, assignee, and log on a legal move', () => {
    const card = buildCard({ id: '0001-x', story: 's', acceptanceCriteria: [] });
    const todo = moveCard(card, 'todo');
    const inProg = moveCard(todo, 'in-progress');
    expect(inProg.data.state).toBe('in-progress');
    expect(inProg.data.assignee).toBe('maker');
    expect(inProg.content).toContain('todo → in-progress (maker)');
  });

  it('throws on an illegal move', () => {
    const card = buildCard({ id: '0001-x', story: 's', acceptanceCriteria: [] });
    expect(() => moveCard(card, 'done')).toThrow(/illegal transition/);
  });
});

describe('parseCard', () => {
  it('validates and coerces frontmatter', () => {
    const parsed = parseCard({
      data: { id: '0001-x', state: 'todo', assignee: 'scout' },
      content: 'body',
    });
    expect(parsed.data.gravity).toBe('normal');
    expect(parsed.data.blocked_by).toEqual([]);
  });

  it('rejects an unknown state', () => {
    expect(() =>
      parseCard({ data: { id: 'x', state: 'nope', assignee: 'scout' }, content: '' }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test src/domain/card.test.ts`
Expected: FAIL — `Cannot find module './card.js'`.

- [ ] **Step 3: Implement `src/domain/card.ts`**

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test src/domain/card.test.ts`
Expected: PASS (all `card` describe blocks).

- [ ] **Step 5: Commit**

```bash
git add src/domain/card.ts src/domain/card.test.ts
git commit -m "feat: card domain — schema, state machine, builders"
```

---

### Task 4: Paths + card store (file-backed CRUD + ops)

**Files:**
- Create: `src/store/paths.ts`
- Create: `src/store/cardStore.ts`
- Test: `src/store/cardStore.test.ts`

**Interfaces:**
- Consumes: card domain (`buildCard`, `moveCard`, `parseCard`, `CardState`, `CardFrontmatter`, `BuildCardInput`); `nextId`; frontmatter file I/O.
- Produces (`paths.ts`): `boardDir(root)`, `plansDir(root)`, `ledgerDir(root)`, `cardPath(root, id)`, `indexPath(dir)`, `entityIds(dir): string[]`.
- Produces (`cardStore.ts`): `listCardIds(root): string[]`; `readCard(root, id): FrontmatterFile<CardFrontmatter>`; `createCard(root, input: Omit<BuildCardInput,'id'>): FrontmatterFile<CardFrontmatter>`; `moveCardInStore(root, id, to: CardState): FrontmatterFile<CardFrontmatter>`.

- [ ] **Step 1: Write the failing test**

`src/store/cardStore.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listCardIds, readCard, createCard, moveCardInStore } from './cardStore.js';

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'cnst-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('cardStore', () => {
  it('creates a card with a sequential id and persists it', () => {
    const card = createCard(root, { story: 'Export CSV', acceptanceCriteria: ['has headers'] });
    expect(card.data.id).toBe('0001-export-csv');
    expect(readCard(root, '0001-export-csv').data.state).toBe('backlog');
  });

  it('increments ids across creates', () => {
    createCard(root, { story: 'First', acceptanceCriteria: [] });
    const second = createCard(root, { story: 'Second', acceptanceCriteria: [] });
    expect(second.data.id).toBe('0002-second');
    expect(listCardIds(root).sort()).toEqual(['0001-first', '0002-second']);
  });

  it('moves a card through legal states and persists assignee', () => {
    const card = createCard(root, { story: 'Work', acceptanceCriteria: [] });
    moveCardInStore(root, card.data.id, 'todo');
    const moved = moveCardInStore(root, card.data.id, 'in-progress');
    expect(moved.data.state).toBe('in-progress');
    expect(moved.data.assignee).toBe('maker');
    expect(readCard(root, card.data.id).data.assignee).toBe('maker');
  });

  it('throws on an illegal move', () => {
    const card = createCard(root, { story: 'Work', acceptanceCriteria: [] });
    expect(() => moveCardInStore(root, card.data.id, 'done')).toThrow(/illegal transition/);
  });

  it('returns an empty list when the board does not exist', () => {
    expect(listCardIds(root)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test src/store/cardStore.test.ts`
Expected: FAIL — `Cannot find module './cardStore.js'`.

- [ ] **Step 3: Implement `src/store/paths.ts`**

```ts
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
```

- [ ] **Step 4: Implement `src/store/cardStore.ts`**

```ts
import { boardDir, cardPath, entityIds } from './paths.js';
import {
  readFrontmatterFile,
  writeFrontmatterFile,
  type FrontmatterFile,
} from '../fs/frontmatterFile.js';
import {
  buildCard,
  moveCard,
  parseCard,
  type BuildCardInput,
  type CardFrontmatter,
  type CardState,
} from '../domain/card.js';
import { nextId } from '../domain/ids.js';

export function listCardIds(root: string): string[] {
  return entityIds(boardDir(root));
}

export function readCard(root: string, id: string): FrontmatterFile<CardFrontmatter> {
  return parseCard(readFrontmatterFile<unknown>(cardPath(root, id)));
}

export function createCard(
  root: string,
  input: Omit<BuildCardInput, 'id'>,
): FrontmatterFile<CardFrontmatter> {
  const id = nextId(listCardIds(root), input.story);
  const card = buildCard({ ...input, id });
  writeFrontmatterFile(cardPath(root, id), card);
  return card;
}

export function moveCardInStore(
  root: string,
  id: string,
  to: CardState,
): FrontmatterFile<CardFrontmatter> {
  const moved = moveCard(readCard(root, id), to);
  writeFrontmatterFile(cardPath(root, id), moved);
  return moved;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test src/store/cardStore.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/store/paths.ts src/store/cardStore.ts src/store/cardStore.test.ts
git commit -m "feat: card store — file-backed CRUD and move ops"
```

---

### Task 5: Index regeneration

**Files:**
- Create: `src/store/indexer.ts`
- Test: `src/store/indexer.test.ts`

**Interfaces:**
- Consumes: `boardDir`, `indexPath`, `entityIds` from paths; `readCard`, `listCardIds`; frontmatter write.
- Produces:
  - `interface IndexRow { sortKey: string; line: string }`.
  - `renderIndex(title: string, rows: IndexRow[]): string`.
  - `firstLineOfSection(content: string, heading: string): string` (helper to pull a one-line summary, e.g. the Story).
  - `regenerateCardIndex(root: string): string` — writes `.constellation/board/_index.md`, returns its content.

- [ ] **Step 1: Write the failing test**

`src/store/indexer.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderIndex, firstLineOfSection, regenerateCardIndex } from './indexer.js';
import { createCard, moveCardInStore } from './cardStore.js';
import { indexPath, boardDir } from './paths.js';

describe('renderIndex', () => {
  it('sorts rows by sortKey and renders bullets under a title', () => {
    const out = renderIndex('Board', [
      { sortKey: '0002', line: 'b' },
      { sortKey: '0001', line: 'a' },
    ]);
    expect(out).toBe('# Board\n\n- a\n- b\n');
  });
});

describe('firstLineOfSection', () => {
  it('returns the first non-empty line under a heading', () => {
    expect(firstLineOfSection('## Story\nHello world\n\n## Log', 'Story')).toBe('Hello world');
  });
  it('returns empty string when the heading is missing', () => {
    expect(firstLineOfSection('## Log\nx', 'Story')).toBe('');
  });
});

describe('regenerateCardIndex', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'cnst-'));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('lists each card with id, state, assignee and story summary', () => {
    const c = createCard(root, { story: 'Export CSV', acceptanceCriteria: [] });
    moveCardInStore(root, c.data.id, 'todo');
    const content = regenerateCardIndex(root);
    expect(content).toContain('0001-export-csv');
    expect(content).toContain('[todo]');
    expect(content).toContain('Export CSV');
    expect(readFileSync(indexPath(boardDir(root)), 'utf8')).toBe(content);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test src/store/indexer.test.ts`
Expected: FAIL — `Cannot find module './indexer.js'`.

- [ ] **Step 3: Implement `src/store/indexer.ts`**

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test src/store/indexer.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/store/indexer.ts src/store/indexer.test.ts
git commit -m "feat: board index regeneration"
```

---

### Task 6: Plan domain + store

**Files:**
- Create: `src/domain/plan.ts`
- Create: `src/store/planStore.ts`
- Test: `src/store/planStore.test.ts`

**Interfaces:**
- Consumes: frontmatter I/O; `plansDir`, `entityIds`, `indexPath`; `nextId`; `renderIndex`, `firstLineOfSection`.
- Produces (`plan.ts`):
  - `PlanFrontmatter` (zod: `id: string`, `status: 'active'|'superseded'|'done'` default `active`, `problem: string`), `type PlanFrontmatter`.
  - `interface BuildPlanInput { id: string; problem: string }`.
  - `buildPlan(input): FrontmatterFile<PlanFrontmatter>`.
  - `parsePlan(file): FrontmatterFile<PlanFrontmatter>`.
- Produces (`planStore.ts`): `listPlanIds(root)`; `readPlan(root, id)`; `createPlan(root, { problem })`; `regeneratePlanIndex(root): string`.

- [ ] **Step 1: Write the failing test**

`src/store/planStore.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPlan, readPlan, listPlanIds, regeneratePlanIndex } from './planStore.js';

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'cnst-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('planStore', () => {
  it('creates an active plan with a sequential id and template body', () => {
    const plan = createPlan(root, { problem: 'analysts cannot export data' });
    expect(plan.data.id).toBe('0001-analysts-cannot-export-data');
    expect(plan.data.status).toBe('active');
    expect(plan.content).toContain('## Verified problem');
    expect(plan.content).toContain('## Decomposition');
    expect(plan.content).toContain('## Revision log');
    expect(readPlan(root, plan.data.id).data.problem).toBe('analysts cannot export data');
  });

  it('indexes plans by id, status and problem', () => {
    createPlan(root, { problem: 'first problem' });
    const content = regeneratePlanIndex(root);
    expect(content).toContain('0001-first-problem');
    expect(content).toContain('[active]');
    expect(content).toContain('first problem');
    expect(listPlanIds(root)).toEqual(['0001-first-problem']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test src/store/planStore.test.ts`
Expected: FAIL — `Cannot find module './planStore.js'`.

- [ ] **Step 3: Implement `src/domain/plan.ts`**

```ts
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
```

- [ ] **Step 4: Implement `src/store/planStore.ts`**

```ts
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
import { renderIndex, firstLineOfSection } from './indexer.js';

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
```

(Note: `firstLineOfSection` is imported to keep parity with the card indexer pattern; plan summaries use the `problem` frontmatter field directly.)

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test src/store/planStore.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Remove the unused import**

In `src/store/planStore.ts`, delete `firstLineOfSection` from the import (the strict build flags unused names). Final import line:
```ts
import { renderIndex } from './indexer.js';
```

- [ ] **Step 7: Commit**

```bash
git add src/domain/plan.ts src/store/planStore.ts src/store/planStore.test.ts
git commit -m "feat: plan domain and store"
```

---

### Task 7: Ledger domain + store

**Files:**
- Create: `src/domain/ledger.ts`
- Create: `src/store/ledgerStore.ts`
- Test: `src/store/ledgerStore.test.ts`

**Interfaces:**
- Consumes: frontmatter I/O; `ledgerDir`, `entityIds`, `indexPath`; `renderIndex`.
- Produces (`ledger.ts`):
  - `LedgerFrontmatter` (zod: `name: string`, `description: string`, `polarity: 'positive'|'negative'`, `card: z.string().optional()`), `type LedgerFrontmatter`.
  - `interface BuildLedgerInput { name: string; description: string; polarity: 'positive'|'negative'; card?: string; achievement: string; purpose: string; proof: string }`.
  - `buildLedgerEntry(input): FrontmatterFile<LedgerFrontmatter>`.
  - `parseLedgerEntry(file): FrontmatterFile<LedgerFrontmatter>`.
- Produces (`ledgerStore.ts`): `readLedgerEntry(root, name)`; `writeLedgerEntry(root, entry): void`; `listLedgerNames(root)`; `regenerateLedgerIndex(root): string`.

- [ ] **Step 1: Write the failing test**

`src/store/ledgerStore.test.ts`:
```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test src/store/ledgerStore.test.ts`
Expected: FAIL — `Cannot find module './ledgerStore.js'`.

- [ ] **Step 3: Implement `src/domain/ledger.ts`**

```ts
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
```

- [ ] **Step 4: Implement `src/store/ledgerStore.ts`**

```ts
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
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test src/store/ledgerStore.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/domain/ledger.ts src/store/ledgerStore.ts src/store/ledgerStore.test.ts
git commit -m "feat: ledger domain and store"
```

---

### Task 8: Done → ledger projection

**Files:**
- Create: `src/domain/projectDone.ts`
- Create: `src/ops/markDone.ts`
- Test: `src/ops/markDone.test.ts`

**Interfaces:**
- Consumes: card domain + store; ledger domain + store; indexers.
- Produces (`projectDone.ts`):
  - `interface DoneInput { achievement: string; proof: string; polarity?: 'positive'|'negative'; description?: string }`.
  - `projectDone(card: FrontmatterFile<CardFrontmatter>, input: DoneInput): FrontmatterFile<LedgerFrontmatter>` — purpose taken from the card's Story section; ledger `name` derived from card id; `card` set to the card id.
- Produces (`markDone.ts`):
  - `markDone(root: string, id: string, input: DoneInput): { card; entry }` — requires the card to be in `in-testing`, moves it to `done`, writes the ledger entry, regenerates board + ledger indexes.

- [ ] **Step 1: Write the failing test**

`src/ops/markDone.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCard, moveCardInStore, readCard } from '../store/cardStore.js';
import { readLedgerEntry, listLedgerNames } from '../store/ledgerStore.js';
import { markDone } from './markDone.js';

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'cnst-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function intoTesting(): string {
  const c = createCard(root, {
    story: 'As an analyst I want CSV export so that I can share data',
    acceptanceCriteria: ['has headers'],
  });
  moveCardInStore(root, c.data.id, 'todo');
  moveCardInStore(root, c.data.id, 'in-progress');
  moveCardInStore(root, c.data.id, 'in-testing');
  return c.data.id;
}

describe('markDone', () => {
  it('moves the card to done and writes a projected ledger entry', () => {
    const id = intoTesting();
    const { card, entry } = markDone(root, id, {
      achievement: 'CSV export works',
      proof: 'criteria pass + critic verdict',
    });
    expect(card.data.state).toBe('done');
    expect(readCard(root, id).data.state).toBe('done');
    expect(entry.data.card).toBe(id);
    expect(entry.data.polarity).toBe('positive');
    expect(entry.content).toContain('**Purpose:** As an analyst I want CSV export so that I can share data');
    expect(entry.content).toContain('**Achievement:** CSV export works');
    expect(readLedgerEntry(root, entry.data.name).data.card).toBe(id);
    expect(listLedgerNames(root)).toHaveLength(1);
  });

  it('refuses to mark done a card that is not in testing', () => {
    const c = createCard(root, { story: 'x', acceptanceCriteria: [] });
    expect(() => markDone(root, c.data.id, { achievement: 'a', proof: 'p' })).toThrow(
      /illegal transition/,
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test src/ops/markDone.test.ts`
Expected: FAIL — `Cannot find module './markDone.js'`.

- [ ] **Step 3: Implement `src/domain/projectDone.ts`**

```ts
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
```

- [ ] **Step 4: Implement `src/ops/markDone.ts`**

```ts
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
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test src/ops/markDone.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/domain/projectDone.ts src/ops/markDone.ts src/ops/markDone.test.ts
git commit -m "feat: Done → ledger projection"
```

---

### Task 9: CLI wiring + integration test + build

**Files:**
- Create: `src/cli.ts`
- Test: `src/cli.test.ts`

**Interfaces:**
- Consumes: all stores and ops.
- Produces: a `commander` program with commands:
  - `card create --story <s> [--ac <c...>] [--plan <id>] [--gravity <g>]`
  - `card move <id> <state>`
  - `card done <id> --achievement <a> --proof <p> [--negative]`
  - `card list`
  - `plan create --problem <p>`
  - `index` (regenerates all three indexes)
  - Each command operates on `process.cwd()` as `root` and prints a one-line result.
  - `export function run(argv: string[], root: string): void` for testability; the file's entry guard calls `run(process.argv, process.cwd())`.

- [ ] **Step 1: Write the failing test**

`src/cli.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from './cli.js';
import { indexPath, boardDir } from './store/paths.js';

let root: string;
let logs: string[];
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'cnst-'));
  logs = [];
  vi.spyOn(console, 'log').mockImplementation((m?: unknown) => {
    logs.push(String(m));
  });
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  vi.restoreAllMocks();
});

function cli(...args: string[]): void {
  run(['node', 'cli', ...args], root);
}

describe('cli', () => {
  it('creates, moves, and completes a card end-to-end', () => {
    cli('card', 'create', '--story', 'Export CSV', '--ac', 'has headers');
    expect(logs.join('\n')).toContain('0001-export-csv');

    cli('card', 'move', '0001-export-csv', 'todo');
    cli('card', 'move', '0001-export-csv', 'in-progress');
    cli('card', 'move', '0001-export-csv', 'in-testing');
    cli('card', 'done', '0001-export-csv', '--achievement', 'works', '--proof', 'criteria pass');

    cli('index');
    expect(existsSync(indexPath(boardDir(root)))).toBe(true);

    logs = [];
    cli('card', 'list');
    expect(logs.join('\n')).toContain('0001-export-csv [done]');
  });

  it('reports an illegal transition as an error without throwing', () => {
    cli('card', 'create', '--story', 'X');
    cli('card', 'move', '0001-x', 'done');
    expect(logs.join('\n')).toMatch(/illegal transition/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test src/cli.test.ts`
Expected: FAIL — `Cannot find module './cli.js'`.

- [ ] **Step 3: Implement `src/cli.ts`**

```ts
import { Command } from 'commander';
import { fileURLToPath } from 'node:url';
import { createCard, moveCardInStore, listCardIds, readCard } from './store/cardStore.js';
import { createPlan } from './store/planStore.js';
import { markDone } from './ops/markDone.js';
import { regenerateCardIndex } from './store/indexer.js';
import { regeneratePlanIndex } from './store/planStore.js';
import { regenerateLedgerIndex } from './store/ledgerStore.js';
import type { CardState } from './domain/card.js';

export function run(argv: string[], root: string): void {
  const program = new Command();
  program.name('constellation').exitOverride();

  const card = program.command('card');

  card
    .command('create')
    .requiredOption('--story <story>', 'user story')
    .option('--ac <criteria...>', 'acceptance criteria', [])
    .option('--plan <id>', 'parent plan id')
    .option('--gravity <gravity>', 'low|normal|high', 'normal')
    .action((opts) => {
      const c = createCard(root, {
        story: opts.story,
        acceptanceCriteria: opts.ac ?? [],
        plan: opts.plan,
        gravity: opts.gravity,
      });
      console.log(`created ${c.data.id} [${c.data.state}]`);
    });

  card
    .command('move <id> <state>')
    .action((id: string, state: string) => {
      const c = moveCardInStore(root, id, state as CardState);
      console.log(`${c.data.id} → ${c.data.state} (${c.data.assignee})`);
    });

  card
    .command('done <id>')
    .requiredOption('--achievement <text>')
    .requiredOption('--proof <text>')
    .option('--negative', 'record as a negative achievement', false)
    .action((id: string, opts) => {
      const { entry } = markDone(root, id, {
        achievement: opts.achievement,
        proof: opts.proof,
        polarity: opts.negative ? 'negative' : 'positive',
      });
      console.log(`done ${id} → ledger ${entry.data.name}`);
    });

  card.command('list').action(() => {
    for (const id of listCardIds(root)) {
      const c = readCard(root, id);
      console.log(`${id} [${c.data.state}] (${c.data.assignee})`);
    }
  });

  program
    .command('plan')
    .command('create')
    .requiredOption('--problem <text>')
    .action((opts) => {
      const p = createPlan(root, { problem: opts.problem });
      console.log(`created ${p.data.id} [${p.data.status}]`);
    });

  program.command('index').action(() => {
    regenerateCardIndex(root);
    regeneratePlanIndex(root);
    regenerateLedgerIndex(root);
    console.log('regenerated board, plans, ledger indexes');
  });

  try {
    program.parse(argv);
  } catch (err) {
    console.log(`error: ${(err as Error).message}`);
  }
}

const isEntry = process.argv[1] === fileURLToPath(import.meta.url);
if (isEntry) {
  run(process.argv, process.cwd());
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test src/cli.test.ts`
Expected: PASS (2 tests). The illegal-transition case is caught and printed (commander's `exitOverride` plus the try/catch keep the process from exiting).

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS — all test files green.

- [ ] **Step 6: Verify the build compiles**

Run: `npm run build`
Expected: `dist/` produced, no type errors. (If `regeneratePlanIndex`'s unused import from Task 6 Step 6 was missed, fix it now.)

- [ ] **Step 7: Smoke-test the built CLI**

Run:
```bash
cd "$(mktemp -d)" && node "$OLDPWD/dist/cli.js" card create --story "Smoke test" --ac "it runs" && cat .constellation/board/0001-smoke-test.md
```
Expected: prints `created 0001-smoke-test [backlog]` and shows the card file with frontmatter (`state: backlog`, `assignee: scout`) and the Story/Acceptance/Log/Achievement body.

- [ ] **Step 8: Commit**

```bash
git add src/cli.ts src/cli.test.ts
git commit -m "feat: constellation board CLI"
```

---

## Self-Review

**Spec coverage (against §3.3 data model + §8 ledger):**
- Card schema (state/assignee/priority/gravity/plan/blocked_by) → Task 3 ✓
- `state` as field, columns as views → Tasks 3–5 (no file moves; index is a view) ✓
- Sequential+slug IDs → Task 2 ✓
- Directory layout `.constellation/{board,plans,ledger}` → Task 4 (paths) ✓
- Done reachable only from in-testing → Task 3 (state machine) + Task 8 (markDone) ✓
- Done projects achievement-triple (purpose from Story, proof, achievement) → Task 8 ✓
- Negative achievements first-class → Task 7 (polarity) + Task 8 (`--negative`) ✓
- Index per store (only file loaded by default; `_index.md`) → Tasks 5, 6, 7 ✓
- Plan-artifact (problem, approach, decomposition, revision log) → Task 6 ✓

**Out of scope (correctly, per spec):** agents, orchestrator/scheduler, boot sequence, gravity-driven Critic rigor (v2). These are Plan 2 / v2.

**Placeholder scan:** no TBD/TODO; every code step is complete and runnable. The `_(parenthetical)_` strings in plan/card templates are intentional author-facing prompts inside generated files, not plan placeholders.

**Type consistency:** `FrontmatterFile<T>`, `CardFrontmatter`, `CardState`, `PlanFrontmatter`, `LedgerFrontmatter`, `DoneInput` names are used identically across tasks. `renderIndex`/`firstLineOfSection`/`regenerate*Index` signatures match between definition (Task 5) and consumers (Tasks 6–8). `markDone` return shape `{ card, entry }` matches its test.

**Known follow-through:** Task 6 introduces then removes an unused `firstLineOfSection` import (Steps 5–6); Task 9 Step 6 re-checks the build catches any missed unused import. Acceptable — kept explicit rather than hidden.
