import { claimUpload } from '@/lib/upload-claims';
import { prepareGtfs } from '@/lib/prepare-gtfs';
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
import { cleanupGeneration, reserveGeneration } from '@/lib/generation-files';
import { generationProgressResponse } from '@/lib/generation-progress-response';
import { GENERATION_STREAM_TYPE } from '@/lib/generation-events';

import { verifyUploadTicket } from '@/lib/upload-ticket';
import { deleteUpload, downloadUpload } from '@/lib/blob-upload';

export const runtime = 'nodejs';

export const maxDuration = 900; // 15 minutes

export const POST = async (request: Request) => {
  const deadline = Date.now() + GENERATION_TIMEOUT_MS;
  let body: { pathname?: unknown; ticket?: unknown; options?: unknown };
  try {
    body = await request.json();
    if (
      !body ||
      typeof body !== 'object' ||
      !verifyUploadTicket(body.pathname, body.ticket)
    ) {
      return NextResponse.json(
        {
          error: 'Invalid or expired upload. Please upload your GTFS again.',
          success: false,
        },
        { status: 400 },
      );
    }
  } catch {
    return NextResponse.json(
      { error: 'Invalid upload request.', success: false },
      { status: 400 },
    );
  }

  const pathname = body.pathname as string;
  // Losing concurrent requests must not delete the winning request's input.
  try {
    await claimUpload(pathname, body.ticket as string, 'generation');
  } catch (error) {
    const result = getPublicGtfsErrorResponse(error);
    return NextResponse.json(
      { error: result.error, success: false },
      { status: result.statusCode },
    );
  }
  let tempDir: string | undefined;
  let streaming = false;
  let uploadDeleted = false;
  try {
    const parsedOptions = body.options;
    if (
      parsedOptions !== undefined &&
      (!parsedOptions ||
        typeof parsedOptions !== 'object' ||
        Array.isArray(parsedOptions))
    ) {
      return NextResponse.json(
        { error: 'Invalid options. Expected an object.', success: false },
        { status: 400 },
      );
    }
    tempDir = temporaryDirectory();
    reserveGeneration(tempDir);
    const gtfsPath = join(tempDir, 'input.zip');
    try {
      await downloadUpload(
        pathname,
        gtfsPath,
        AbortSignal.any([request.signal, AbortSignal.timeout(60_000)]),
      );
    } catch (error) {
      console.error('Unable to read uploaded GTFS:', error);
      return NextResponse.json(
        {
          error:
            'Unable to read uploaded GTFS. Please upload a ZIP of up to 50 MB and try again.',
          success: false,
        },
        { status: 400 },
      );
    }
    // The worker only needs its local copy. Empty Blob before handing off
    // to the stream, retaining the pathname until client tokens expire.
    await deleteUpload(pathname);
    uploadDeleted = true;

    const feedPath = await prepareGtfs(
      gtfsPath,
      join(tempDir, 'feed'),
      AbortSignal.any([request.signal, AbortSignal.timeout(60_000)]),
    );
    const buildId = randomUUID();
    const gtfsConfig = {
      ...parsedOptions,
      agencies: [
        {
          agencyKey: buildId,
          path: feedPath,
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
    );
    streaming = true;
    return response;
  } catch (error) {
    console.error('Error occurred ', error);
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
    if (!uploadDeleted) {
      await deleteUpload(pathname);
    }
    if (tempDir && !streaming) {
      await cleanupGeneration(tempDir);
    }
  }
};
