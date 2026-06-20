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
