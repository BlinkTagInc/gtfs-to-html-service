import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { get, put } from '@vercel/blob';
import { MAX_UPLOAD_BYTES } from './upload-limits.ts';

export const deleteUpload = async (pathname: string) => {
  try {
    // Cleanup must still run after the generation request is aborted.
    // Retain an empty tombstone so live no-overwrite client tokens cannot
    // recreate this pathname after consumption. Cron removes it after expiry.
    await put(pathname, Buffer.alloc(0), {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/octet-stream',
      abortSignal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    console.error(
      'Unable to delete uploaded GTFS; scheduled cleanup will retry.',
      error,
    );
  }
};

export const downloadUpload = async (
  pathname: string,
  destination: string,
  signal: AbortSignal,
) => {
  const result = await get(pathname, {
    access: 'private',
    abortSignal: signal,
  });
  if (!result || result.statusCode !== 200) {
    throw new Error('Uploaded GTFS is unavailable.');
  }
  if (result.blob.size > MAX_UPLOAD_BYTES) {
    await result.stream.cancel();
    throw new Error('Uploaded GTFS exceeds 50 MB.');
  }
  // Bound actual bytes too, and stream to disk without buffering the entire ZIP.
  let bytes = 0;
  await pipeline(
    result.stream,
    async function* (source) {
      for await (const chunk of source) {
        bytes += chunk.length;
        if (bytes > MAX_UPLOAD_BYTES) {
          throw new Error('Uploaded GTFS exceeds 50 MB.');
        }
        yield chunk;
      }
    },
    createWriteStream(destination, { flags: 'wx' }),
    { signal },
  );
};
