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
