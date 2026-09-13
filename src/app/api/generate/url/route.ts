import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

import { NextResponse } from 'next/server';
import { temporaryDirectory } from 'tempy';
import { getPublicGtfsErrorResponse } from '@/lib/gtfs-error';
import {
  generateInWorker,
  GENERATION_TIMEOUT_MS,
} from '@/lib/generation-worker';
import { generationResponse } from '@/lib/generation-response';
import { cleanupGeneration } from '@/lib/generation-files';
import { generationProgressResponse } from '@/lib/generation-progress-response';
import { GENERATION_STREAM_TYPE } from '@/lib/generation-events';

export const runtime = 'nodejs';

export const maxDuration = 800; // 13 minutes 20 seconds

export const POST = async (request: Request) => {
  const deadline = Date.now() + GENERATION_TIMEOUT_MS;
  let body: { url?: unknown; options?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: 'Invalid request body. Please submit valid JSON.',
        code: 'INVALID_REQUEST',
        category: 'request',
        success: false,
      },
      { status: 400 },
    );
  }

  const gtfsUrl = typeof body.url === 'string' ? body.url.trim() : '';
  const options: Record<string, unknown> | undefined =
    body.options &&
    typeof body.options === 'object' &&
    !Array.isArray(body.options)
      ? (body.options as Record<string, unknown>)
      : undefined;

  if (!gtfsUrl) {
    return NextResponse.json(
      {
        error: 'Missing URL. Please provide a GTFS zip URL.',
        code: 'MISSING_URL',
        category: 'request',
        success: false,
      },
      { status: 400 },
    );
  }

  let tempDir: string | undefined;
  let streaming = false;
  try {
    tempDir = temporaryDirectory();
    const buildId = randomUUID();
    const gtfsConfig = {
      ...(options || {}),
      agencies: [
        {
          agencyKey: buildId,
          url: gtfsUrl,
        },
      ],
      outputPath: join(tempDir, buildId),
    };
    if (request.headers.get('accept')?.includes(GENERATION_STREAM_TYPE)) {
      const response = generationProgressResponse(
        gtfsConfig,
        tempDir,
        buildId,
        request,
        deadline,
        gtfsUrl,
      );
      streaming = true;
      return response;
    }
    const timetablePath = await generateInWorker(
      gtfsConfig,
      tempDir,
      request.signal,
      deadline,
    );

    const response = await generationResponse(
      timetablePath,
      tempDir,
      buildId,
      request,
      gtfsUrl,
    );
    streaming = true;
    return response;
  } catch (error) {
    console.error(error);
    const publicError = getPublicGtfsErrorResponse(error);

    return NextResponse.json(
      {
        error: publicError.error,
        code: publicError.code,
        category: publicError.category,
        success: false,
      },
      { status: publicError.statusCode },
    );
  } finally {
    if (tempDir && !streaming) {
      await cleanupGeneration(tempDir);
    }
  }
};
