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
    expect(existsSync(join(root, '.constellation', 'ledger', '0001-export-csv-achievement.md'))).toBe(true);

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
