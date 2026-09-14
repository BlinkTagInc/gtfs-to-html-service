import { del, list } from '@vercel/blob';
import {
  isUploadPathname,
  UPLOAD_PREFIX,
  UPLOAD_MAX_AGE_MS,
} from '@/lib/upload-limits';

export const runtime = 'nodejs';
export const maxDuration = 60;

export const GET = async (request: Request) => {
  if (
    !process.env.CRON_SECRET ||
    request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return new Response('Unauthorized', { status: 401 });
  }
  try {
    const cutoff = Date.now() - UPLOAD_MAX_AGE_MS;
    let cursor: string | undefined;
    let deleted = 0;
    do {
      const page = await list({ prefix: UPLOAD_PREFIX, cursor, limit: 1000 });
      const stale = page.blobs.filter(
        (blob) =>
          isUploadPathname(blob.pathname) && blob.uploadedAt.getTime() < cutoff,
      );
      if (stale.length > 0) {
        await del(stale.map((blob) => blob.url));
        deleted += stale.length;
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return Response.json({ deleted });
  } catch (error) {
    console.error('Upload cleanup failed:', error);
    return Response.json({ error: 'Upload cleanup failed.' }, { status: 500 });
  }
};
