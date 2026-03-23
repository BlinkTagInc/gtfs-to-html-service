import { randomUUID } from 'node:crypto';
import { createReadStream, statSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { NextResponse } from 'next/server';
import { track } from '@vercel/analytics/server';
import gtfsToHtml from 'gtfs-to-html';
import { temporaryDirectory } from 'tempy';
import { getPublicGtfsErrorResponse } from '@/lib/gtfs-error';

export const maxDuration = 300; // 5 minutes

export const POST = async (request: Request) => {
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

  try {
    const tempDir = temporaryDirectory();
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
      sqlitePath: ':memory:',
      skipImport: false,
      templatePath: join(process.cwd(), 'views'),
      verbose: false,
      zipOutput: true,
      log: () => {},
      logWarning: () => {},
      logError: () => {},
    } as unknown as Parameters<typeof gtfsToHtml>[0];
    const timetablePath = await gtfsToHtml(gtfsConfig);

    const fileStats = statSync(timetablePath);
    const fileStream = createReadStream(timetablePath);

    // Read the log file
    const logFileContent = await readFile(
      join(tempDir, buildId, 'log.txt'),
      'utf8',
    );
    const agenciesLine = logFileContent
      ?.split('\n')
      .find((line: string) => line.startsWith('Agencies'));
    const agencies = agenciesLine?.replace('Agencies: ', '') || '';

    return new NextResponse(
      new ReadableStream({
        async start(controller) {
          fileStream.on('data', (chunk) => {
            controller.enqueue(chunk); // Send chunks to the stream
          });

          fileStream.on('end', async () => {
            controller.close(); // Close the stream when done
            // Delete the file after streaming has finished
            try {
              await track('GTFS Uploaded', {
                url: gtfsUrl,
                agencies,
              });
              await rm(tempDir, { recursive: true });
            } catch (error) {
              console.error('Error deleting file:', error);
            }
          });

          fileStream.on('error', (err) => {
            console.error('Error reading file:', err);
            controller.error(err); // Handle any read errors
          });
        },
      }),
      {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': 'attachment; filename="timetables.zip"',
          'Content-Length': fileStats.size.toString(), // Set the content length
        },
      },
    );
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
  }
};
