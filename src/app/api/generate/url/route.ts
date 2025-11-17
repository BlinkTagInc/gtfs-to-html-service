import { randomUUID } from 'node:crypto';
import { createReadStream, statSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { NextResponse } from 'next/server';
import { track } from '@vercel/analytics/server';
import gtfsToHtml from 'gtfs-to-html';
import { temporaryDirectory } from 'tempy';

export const maxDuration = 300; // 5 minutes

export const POST = async (request: Request) => {
  const body = await request.json();
  const gtfsUrl = body.url;
  const options = body.options;

  if (!gtfsUrl) {
    return NextResponse.json(
      {
        error: 'Missing URL',
        success: false,
      },
      { status: 400 },
    );
  }

  try {
    const tempDir = temporaryDirectory();
    const buildId = randomUUID();
    const timetablePath = await gtfsToHtml({
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
    });

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

    // Extract meaningful error message from the error object
    let errorMessage = 'Unable to process GTFS';
    let statusCode = 400;

    if (error instanceof Error) {
      const errorString = error.message;

      // Check for specific error types and provide more helpful messages
      if (errorString.includes('Unable to download GTFS')) {
        errorMessage = errorString;

        // Extract status code if available (e.g., "Got status 404")
        const statusMatch = errorString.match(/Got status (\d+)/);
        if (statusMatch) {
          const httpStatus = parseInt(statusMatch[1], 10);
          if (httpStatus === 404) {
            errorMessage = `GTFS file not found at the provided URL. Please verify the URL is correct and the file exists.`;
          } else if (httpStatus === 403) {
            errorMessage = `Access denied to the GTFS file. The URL may require authentication or have restricted access.`;
          } else if (httpStatus >= 500) {
            errorMessage = `Server error when downloading GTFS file. The server may be temporarily unavailable.`;
          } else {
            errorMessage = `Unable to download GTFS file. Server returned status ${httpStatus}.`;
          }
        }
      } else if (
        errorString.includes('ENOTFOUND') ||
        errorString.includes('getaddrinfo')
      ) {
        errorMessage =
          'Unable to reach the server. Please check the URL and your internet connection.';
      } else if (errorString.includes('timeout')) {
        errorMessage =
          'Request timed out. The server may be slow to respond or the file may be too large.';
      } else if (errorString.includes('Invalid GTFS')) {
        errorMessage =
          'The downloaded file is not a valid GTFS file. Please check the file format.';
      } else if (
        errorString.includes('EMFILE') ||
        errorString.includes('ENFILE')
      ) {
        errorMessage =
          'Server is currently busy processing requests. Please try again in a few minutes.';
      } else if (
        errorString.includes('EACCES') ||
        errorString.includes('permission')
      ) {
        errorMessage =
          'Unable to process the GTFS file due to server configuration.';
      } else if (errorString.includes('ENOSPC')) {
        errorMessage =
          'Server storage is temporarily full. Please try again later.';
      } else if (
        errorString.includes('zip') ||
        errorString.includes('archive')
      ) {
        errorMessage =
          'The file appears to be corrupted or is not a valid ZIP archive. Please check the file format.';
      } else {
        // For unknown errors, provide a generic message and log the actual error for debugging
        console.error('Unhandled error in GTFS processing:', errorString);
        errorMessage = 'Unable to process GTFS';
      }
    }

    return NextResponse.json(
      {
        error: errorMessage,
        success: false,
      },
      { status: statusCode },
    );
  }
};
