// Resolves a markdown link href found in a doc of `currentSubject` to a
// site route key. Returns null for external URLs, anchors, and non-doc files.

export interface DocRef {
  subject: string;
  slug: string;
}

/** Site route key for a doc reference: `/subject/slug`. */
export function routeKey(ref: DocRef): string {
  return `/${ref.subject}/${ref.slug}`;
}

export function resolveDocHref(currentSubject: string, href: string): DocRef | null {
  const raw = href.trim();
  if (!raw || raw.startsWith('#') || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) return null;
  const hash = raw.indexOf('#');
  const path = (hash === -1 ? raw : raw.slice(0, hash)).trim();
  if (!path || path.endsWith('/')) return null;

  const withoutMd = path.toLowerCase().endsWith('.md') ? path.slice(0, -3) : path;
  const lastSegment = withoutMd.split('/').pop() ?? '';
  // A non-.md file extension means an asset, not a plan doc.
  if (/\.([a-z0-9]+)$/i.test(lastSegment) && !path.toLowerCase().endsWith('.md')) return null;

  if (withoutMd.startsWith('/')) {
    const parts = withoutMd.slice(1).split('/').filter(Boolean);
    if (parts.length < 2) return null;
    const [subject, ...rest] = parts as [string, ...string[]];
    return { subject, slug: rest.join('/') };
  }
  if (withoutMd.startsWith('../')) {
    const parts = withoutMd.split('/').filter(Boolean);
    if (parts.length < 3) return null;
    const [, subject, ...rest] = parts as [string, string, ...string[]];
    if (!subject || rest.length === 0) return null;
    return { subject, slug: rest.join('/') };
  }
  const slug = withoutMd.replace(/^\.\//, '');
  if (!slug) return null;
  return { subject: currentSubject, slug };
}
