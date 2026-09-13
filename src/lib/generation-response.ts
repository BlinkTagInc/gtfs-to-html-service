import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

import { after, NextResponse } from 'next/server';
import { track } from '@vercel/analytics/server';

import { createGenerationStream } from './generation-files';

export const generationResponse = async (
  timetablePath: string,
  tempDir: string,
  buildId: string,
  request: Request,
  url?: string,
) => {
  const fileStats = await stat(timetablePath);
  const log = await readFile(join(tempDir, buildId, 'log.txt'), 'utf8');
  const agencies =
    log
      .split('\n')
      .find((line) => line.startsWith('Agencies: '))
      ?.slice(10) ?? '';
  const { stream, finish, isComplete } = createGenerationStream(
    timetablePath,
    tempDir,
    request.signal,
  );

  // Cleanup is tied to stream completion, independent of analytics delivery.
  after(async () => {
    await finish();
    if (!isComplete()) {
      return;
    }
    try {
      await track(
        'GTFS Uploaded',
        { agencies, ...(url ? { url } : {}) },
        { request },
      );
    } catch (error) {
      console.error('Error tracking generation:', error);
    }
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="timetables.zip"',
      'Content-Length': fileStats.size.toString(),
      'X-Agencies': encodeURIComponent(agencies),
    },
  });
};
