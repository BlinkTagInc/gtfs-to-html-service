import { get } from '@vercel/blob';
import {
  PREVIEW_PREFIX,
  previewExpiry,
  safePreviewPath,
  previewHeaders,
} from '@/lib/preview-policy';

export const runtime = 'nodejs';

export const GET = async (
  request: Request,
  context: { params: Promise<{ id: string; path: string[] }> },
) => {
  const { id, path } = await context.params;
  const expiry = previewExpiry(id);
  const unavailable = (status: number, message: string) =>
    new Response(message, {
      status,
      headers: {
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  if (expiry === null || !safePreviewPath(path) || path.includes('log.txt')) {
    return unavailable(404, 'Preview not found.');
  }
  if (expiry <= Date.now()) {
    return unavailable(
      410,
      'This timetable preview has expired. Generate a new preview to continue.',
    );
  }
  try {
    const name = path.join('/');
    const blob = await get(`${PREVIEW_PREFIX}${id}/${name}`, {
      access: 'private',
      abortSignal: request.signal,
    });
    if (!blob || blob.statusCode !== 200) {
      return unavailable(404, 'Preview file not found.');
    }
    return new Response(blob.stream, { headers: previewHeaders(name) });
  } catch (error) {
    console.error('Unable to serve timetable preview:', error);
    return unavailable(
      503,
      'Preview temporarily unavailable. Please try again.',
    );
  }
};
