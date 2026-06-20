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
