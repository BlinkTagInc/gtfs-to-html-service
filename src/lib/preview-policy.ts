import { archiveDisposition } from './archive-filename.ts';
export const PREVIEW_PREFIX = 'timetable-previews/';
export const PREVIEW_LIFETIME_MS = 48 * 60 * 60 * 1000;

export type TimetablePreview = {
  url: string;
  expiresAt: string;
  downloadUrl?: string;
};

export const previewExpiry = (id: string, uploadedAt?: Date): number | null => {
  const legacy = /^\d{13}-[0-9a-f]{48}$/.test(id);
  if (legacy) {
    const created = Number(id.slice(0, 13));
    return created <= Date.now() ? created + PREVIEW_LIFETIME_MS : null;
  }
  const match =
    /^[a-z0-9]+(?:-[a-z0-9]+)*-(\d{4}-\d{2}-\d{2})-[0-9a-f]{16}$/.exec(id);
  if (!match) {
    return null;
  }
  const created = Date.parse(`${match[1]}T00:00:00.000Z`);
  if (
    !Number.isFinite(created) ||
    created > Date.now() ||
    new Date(created).toISOString().slice(0, 10) !== match[1]
  ) {
    return null;
  }
  // Without storage metadata, use the latest possible expiry for this UTC day.
  // Serving and cleanup use the actual upload time for the 48-hour lifetime.
  return (
    (uploadedAt?.getTime() ?? created + 24 * 60 * 60 * 1000) +
    PREVIEW_LIFETIME_MS
  );
};

export const safePreviewPath = (parts: string[]) => {
  return (
    parts.length > 0 &&
    parts.every(
      (part) =>
        part.length > 0 &&
        part !== '.' &&
        part !== '..' &&
        !/[\\/\x00-\x1f\x7f]/.test(part),
    )
  );
};

export const previewContentType = (name: string) => {
  const extension = name.split('.').at(-1)?.toLowerCase();
  const types: Record<string, string> = {
    html: 'text/html; charset=utf-8',
    css: 'text/css; charset=utf-8',
    js: 'text/javascript; charset=utf-8',
    json: 'application/json',
    geojson: 'application/geo+json',
    svg: 'image/svg+xml',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    ico: 'image/x-icon',
    woff: 'font/woff',
    woff2: 'font/woff2',
    ttf: 'font/ttf',
    zip: 'application/zip',
    csv: 'text/csv; charset=utf-8',
    pdf: 'application/pdf',
  };
  return types[extension ?? ''] ?? 'application/octet-stream';
};

export const previewHeaders = (name: string) => ({
  'Content-Type': previewContentType(name),
  'Content-Disposition': name.endsWith('.zip')
    ? archiveDisposition(name.split('/').at(-1) ?? 'timetables.zip')
    : 'inline',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Referrer-Policy': 'no-referrer',
  // Opaque origins isolate generated scripts, including when opened directly.
  // CORS permits fonts and data fetches from those sandboxed documents.
  'Content-Security-Policy':
    "sandbox allow-scripts allow-downloads allow-modals allow-popups; object-src 'none'; frame-src 'none'; base-uri 'none'",
  'Access-Control-Allow-Origin': '*',
});
