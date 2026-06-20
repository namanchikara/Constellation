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

  it('maps boundary states to their assignees', () => {
    expect(assigneeForState('backlog')).toBe('scout');
    expect(assigneeForState('done')).toBe('human');
    expect(assigneeForState('wont-do')).toBe('human');
  });

  it('treats done as terminal', () => {
    expect(canTransition('done', 'in-testing')).toBe(false);
    expect(canTransition('done', 'todo')).toBe(false);
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

  it('appends into an empty Log section before the next heading', () => {
    const out = appendLog('## Log\n\n## Achievement', 'first entry');
    expect(out).toContain('## Log\n- first entry');
    expect(out.indexOf('## Achievement')).toBeGreaterThan(out.indexOf('first entry'));
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
