import { slugOf, splitFrontmatter, titleOf } from './types.js';

// Short, plain-text synopsis for hover popovers. Built at build time so the
// client only receives a small JSON map of title + excerpt per linked doc.

export interface Synopsis {
  title: string;
  excerpt: string;
  status: string | null;
  date: string | null;
}

function stripMarkdownInline(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(`{1,3}|[*_~]{1,3})(\S.*?\S)\1/g, '$2')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** First meaningful paragraph of the body: skips headings, fences, tables. */
export function excerptOf(body: string, maxLength = 160): string {
  const paragraph: string[] = [];
  let inFence = false;
  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim();
    if (line.startsWith('```')) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (line === '' || line.startsWith('#') || line.startsWith('|')) {
      if (paragraph.length > 0) break;
      continue;
    }
    if (/^([-*+]|\d+[.)])\s/.test(line) && paragraph.length > 0) break;
    paragraph.push(stripMarkdownInline(line));
    if (paragraph.join(' ').length >= maxLength) break;
  }
  const joined = paragraph.join(' ').trim() || 'No summary available.';
  if (joined.length <= maxLength) return joined;
  const cut = joined.slice(0, maxLength);
  return `${cut.slice(0, cut.lastIndexOf(' ') || maxLength)}…`;
}

export function synopsisOf(file: string, raw: string): Synopsis {
  const { frontmatter, body } = splitFrontmatter(raw);
  const slug = slugOf(file);
  return {
    title: titleOf(body, slug),
    excerpt: excerptOf(body),
    status: frontmatter.status ?? null,
    date: frontmatter.date ?? null,
  };
}
