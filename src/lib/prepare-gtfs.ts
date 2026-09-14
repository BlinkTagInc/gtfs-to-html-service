import StreamZip from 'node-stream-zip';
import { mkdir, rm } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { join, dirname } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { SecurityError } from './security-error.ts';

export const MAX_EXPANDED_BYTES = 200_000_000;
export const MAX_ZIP_ENTRIES = 100;

export const prepareGtfs = async (
  archive: string,
  destination: string,
  signal: AbortSignal,
) => {
  const zip = new StreamZip.async({ file: archive });
  try {
    const entries = Object.values(await zip.entries());
    if (
      entries.length > MAX_ZIP_ENTRIES ||
      entries.reduce((size, entry) => size + entry.size, 0) > MAX_EXPANDED_BYTES
    ) {
      throw new SecurityError(
        'GTFS ZIP must contain at most 100 entries and expand to at most 200 MB.',
        413,
      );
    }
    const files = entries.filter(
      (entry) =>
        !entry.isDirectory &&
        !entry.name.startsWith('__MACOSX/') &&
        /\.(txt|csv)$/i.test(entry.name),
    );
    const folders = new Set(files.map((entry) => dirname(entry.name)));
    if (!files.length || folders.size !== 1) {
      throw new SecurityError(
        'GTFS text files must be together at the top level or in one folder.',
      );
    }
    const names = new Set<string>();
    let bytes = 0;
    let lines = 0;
    await mkdir(destination, { recursive: true });
    for (const entry of files) {
      signal.throwIfAborted();
      const parts = entry.name.split('/');
      if (
        parts.some(
          (part) =>
            !part ||
            part === '.' ||
            part === '..' ||
            /[\\:\x00-\x1f]/.test(part),
        ) ||
        entry.encrypted ||
        !entry.isFile
      ) {
        throw new SecurityError('GTFS ZIP contains an unsupported file.');
      }
      // Flatten a single feed folder; never extract archive-controlled paths.
      const name = parts.at(-1)!.toLowerCase();
      if (names.has(name)) {
        throw new SecurityError('GTFS ZIP contains duplicate filenames.');
      }
      names.add(name);
      const stream = await zip.stream(entry.name);
      await pipeline(
        stream,
        async function* (source) {
          for await (const chunk of source) {
            bytes += chunk.length;
            for (const byte of chunk) {
              if (byte === 10) {
                lines++;
              }
            }
            if (bytes > MAX_EXPANDED_BYTES || lines > 3_000_000) {
              throw new SecurityError(
                'GTFS exceeds the 200 MB or 3 million line processing limit.',
                413,
              );
            }
            yield chunk;
          }
        },
        createWriteStream(join(destination, name), { flags: 'wx' }),
        { signal },
      );
    }
    if (!names.has('agency.txt')) {
      throw new SecurityError('GTFS ZIP is missing agency.txt.');
    }
  } finally {
    await zip.close();
  }
  await rm(archive, { force: true });
  return destination;
};
