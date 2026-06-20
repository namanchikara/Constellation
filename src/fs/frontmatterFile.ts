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

function stripUndefined<T extends object>(obj: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

export function serializeFrontmatter<T extends object>(file: FrontmatterFile<T>): string {
  return matter.stringify(`${file.content.trim()}\n`, stripUndefined(file.data));
}

export function readFrontmatterFile<T>(path: string): FrontmatterFile<T> {
  return parseFrontmatter<T>(readFileSync(path, 'utf8'));
}

export function writeFrontmatterFile<T extends object>(path: string, file: FrontmatterFile<T>): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, serializeFrontmatter(file), 'utf8');
}
