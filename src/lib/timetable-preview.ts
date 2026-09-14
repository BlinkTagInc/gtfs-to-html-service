import { archiveFilename } from './archive-filename.ts';
import { randomBytes } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readdir, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { put, list, del } from '@vercel/blob';
import {
  PREVIEW_PREFIX,
  PREVIEW_LIFETIME_MS,
  previewExpiry,
  previewContentType,
  safePreviewPath,
  type TimetablePreview,
} from './preview-policy.ts';

export const cleanupPreviews = async (onlyId?: string) => {
  let cursor: string | undefined;
  let deleted = 0;
  do {
    const page = await list({
      prefix: `${PREVIEW_PREFIX}${onlyId ? `${onlyId}/` : ''}`,
      cursor,
      limit: 1000,
    });
    const stale = page.blobs.filter((blob) => {
      const id = blob.pathname.slice(PREVIEW_PREFIX.length).split('/')[0];
      const expiry = previewExpiry(id, blob.uploadedAt);
      return expiry !== null && (onlyId === id || expiry <= Date.now());
    });
    if (stale.length) {
      await del(stale.map((blob) => blob.url));
      deleted += stale.length;
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return deleted;
};

export const publishPreview = async (
  directory: string,
  requestSignal: AbortSignal,
  agencies = '',
): Promise<TimetablePreview> => {
  const created = Date.now();
  const agency =
    agencies
      .normalize('NFKD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 80)
      .replace(/^-+|-+$/g, '') || 'timetables';
  const date = new Date(created).toISOString().slice(0, 10);
  const id = `${agency}-${date}-${randomBytes(8).toString('hex')}`;
  const signal = AbortSignal.any([requestSignal, AbortSignal.timeout(60_000)]);
  const files: { path: string; name: string }[] = [];
  let bytes = 0;
  const walk = async (relative = '') => {
    for (const entry of await readdir(join(directory, relative), {
      withFileTypes: true,
    })) {
      signal.throwIfAborted();
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      if (!safePreviewPath(name.split('/')) || entry.isSymbolicLink()) {
        throw new Error('Unsupported preview path.');
      }
      if (entry.isDirectory()) {
        await walk(name);
      } else if (entry.isFile() && entry.name !== 'log.txt') {
        const path = join(directory, name);
        bytes += (await lstat(path)).size;
        files.push({ path, name });
        if (files.length > 5000 || bytes > 500_000_000) {
          throw new Error('Preview exceeds publication limits.');
        }
      }
    }
  };
  await walk();
  if (!files.some((file) => file.name === 'index.html')) {
    throw new Error('No preview index was generated.');
  }
  let next = 0;
  try {
    const results = await Promise.allSettled(
      Array.from({ length: 4 }, async () => {
        while (next < files.length) {
          signal.throwIfAborted();
          const file = files[next++];
          const stream = createReadStream(file.path);
          try {
            await put(
              `${PREVIEW_PREFIX}${id}/${file.name === 'timetables.zip' ? archiveFilename(agencies) : file.name}`,
              stream,
              {
                access: 'private',
                addRandomSuffix: false,
                allowOverwrite: false,
                contentType: previewContentType(file.name),
                abortSignal: signal,
              },
            );
          } finally {
            stream.destroy();
          }
        }
      }),
    );
    const failed = results.find((result) => result.status === 'rejected');
    if (failed?.status === 'rejected') {
      throw failed.reason;
    }
    return {
      url: `/preview/${id}/index.html`,
      downloadUrl: `/preview/${id}/${encodeURIComponent(archiveFilename(agencies))}`,
      expiresAt: new Date(created + PREVIEW_LIFETIME_MS).toISOString(),
    };
  } catch (error) {
    await cleanupPreviews(id).catch((cleanupError) =>
      console.error('Preview cleanup will retry via cron:', cleanupError),
    );
    throw error;
  }
};
