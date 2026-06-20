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
