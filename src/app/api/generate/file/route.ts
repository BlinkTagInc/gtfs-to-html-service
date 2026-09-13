import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
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
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      {
        error: 'Invalid form data. Please upload a GTFS zip file.',
        code: 'INVALID_REQUEST',
        category: 'request',
        success: false,
      },
      { status: 400 },
    );
  }

  const file = formData.get('file');

  if (!file) {
    return NextResponse.json(
      {
        error: 'No file received. Please upload a GTFS zip file.',
        code: 'MISSING_FILE',
        category: 'request',
        success: false,
      },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await (file as Blob).arrayBuffer());

  const filename = 'input.zip';

  let tempDir: string | undefined;
  let streaming = false;
  try {
    tempDir = temporaryDirectory();
    const gtfsPath = join(tempDir, filename);

    await writeFile(gtfsPath, buffer);

    const options = formData.get('options');

    let parsedOptions;
    if (options) {
      try {
        parsedOptions = JSON.parse(options as string);

        if (
          !parsedOptions ||
          typeof parsedOptions !== 'object' ||
          Array.isArray(parsedOptions)
        ) {
          return NextResponse.json(
            {
              error: 'Invalid options JSON. Expected an object.',
              code: 'INVALID_OPTIONS',
              category: 'request',
              success: false,
            },
            { status: 400 },
          );
        }
      } catch (error) {
        console.error(error);

        return NextResponse.json(
          {
            error: 'Invalid options JSON. Please provide valid JSON.',
            code: 'INVALID_OPTIONS',
            category: 'request',
            success: false,
          },
          { status: 400 },
        );
      }
    }

    const buildId = randomUUID();
    const gtfsConfig = {
      ...parsedOptions,
      agencies: [
        {
          agencyKey: buildId,
          path: gtfsPath,
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
    if (tempDir && !streaming) {
      await cleanupGeneration(tempDir);
    }
  }
};
