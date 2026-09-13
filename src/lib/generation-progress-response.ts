import { after, NextResponse } from 'next/server';
import { track } from '@vercel/analytics/server';

import { createGenerationEventStream } from './generation-event-stream';
import { GENERATION_STREAM_TYPE } from './generation-events';

export const generationProgressResponse = (
  config: Record<string, unknown>,
  tempDir: string,
  buildId: string,
  request: Request,
  deadline: number,
  url?: string,
) => {
  const { stream, finished } = createGenerationEventStream(
    config,
    tempDir,
    buildId,
    request.signal,
    deadline,
  );
  after(async () => {
    const result = await finished;
    if (result.complete) {
      try {
        await track(
          'GTFS Uploaded',
          { agencies: result.agencies, ...(url ? { url } : {}) },
          { request },
        );
      } catch (error) {
        console.error('Error tracking generation:', error);
      }
    }
  });
  return new NextResponse(stream, {
    headers: {
      'Content-Type': `${GENERATION_STREAM_TYPE}; charset=utf-8`,
      'Cache-Control': 'no-store, no-transform',
      'X-Content-Type-Options': 'nosniff',
    },
  });
};
