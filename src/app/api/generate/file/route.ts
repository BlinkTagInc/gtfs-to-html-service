import { randomUUID } from 'node:crypto';
import { createReadStream, statSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { NextResponse } from 'next/server';
import gtfsToHtml from 'gtfs-to-html';
import { temporaryDirectory } from 'tempy';

export const maxDuration = 300; // 5 minutes

export const POST = async (request: Request, response: NextResponse) => {
  const formData = await request.formData();
  const file = formData.get('file');

  if (!file) {
    return NextResponse.json(
      {
        error: 'No files received',
        success: false,
      },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await (file as Blob).arrayBuffer());

  // Replace spaces in the file name with underscores
  const filename = (file as File).name.replaceAll(' ', '_');

  try {
    // Write file to temporary directory
    const tempDir = temporaryDirectory();
    const gtfsPath = join(tempDir, filename);

    await writeFile(gtfsPath, buffer);

    const buildId = randomUUID();
    // @ts-ignore
    const timetablePath = await gtfsToHtml({
      agencies: [
        {
          agencyKey: buildId,
          path: gtfsPath,
        },
      ],
      verbose: true,
      zipOutput: true,
      outputPath: join(tempDir, buildId),
    });

    const fileStats = statSync(timetablePath);
    const fileStream = createReadStream(timetablePath);

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
    console.error('Error occurred ', error);
    return NextResponse.json(
      {
        error: 'Unable to process GTFS',
        success: false,
      },
      { status: 400 },
    );
  }
};
