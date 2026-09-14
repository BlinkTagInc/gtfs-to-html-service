import { readdir, lstat } from 'node:fs/promises';
import { join } from 'node:path';

export const checkGenerationResources = async (directory: string) => {
  let bytes = 0;
  let files = 0;
  const walk = async (path: string) => {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const child = join(path, entry.name);
      try {
        if (entry.isDirectory()) {
          await walk(child);
        } else {
          bytes += (await lstat(child)).size;
          files++;
        }
      } catch (error) {
        // The generator may remove scratch files during a scan.
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
      }
      // Includes extracted feed, generated pages, assets, and archive.
      if (bytes > 400_000_000 || files > 2100) {
        throw Object.assign(new Error('Generation resource limit exceeded.'), {
          code: 'GENERATION_RESOURCE_LIMIT',
        });
      }
    }
  };
  await walk(directory);
};
