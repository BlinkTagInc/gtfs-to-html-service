import { SecurityError } from '@/lib/security-error';
import { claimUpload } from '@/lib/upload-claims';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { createUploadTicket, verifyUploadTicket } from '@/lib/upload-ticket';
import { MAX_UPLOAD_BYTES } from '@/lib/upload-limits';
import { deleteUpload } from '@/lib/blob-upload';

export const runtime = 'nodejs';

export const PUT = async () => {
  try {
    return Response.json(createUploadTicket(), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Unable to initialize upload:', error);
    return Response.json(
      { error: 'File uploads are temporarily unavailable.' },
      { status: 503 },
    );
  }
};

export const POST = async (request: Request) => {
  try {
    const body = (await request.json()) as HandleUploadBody;
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname, ticket) => {
        // Anonymous uploads are intentional. A signed ticket restricts each
        // token to a server-issued pathname and authorizes later consumption.
        if (!verifyUploadTicket(pathname, ticket)) {
          throw new Error('Invalid upload ticket.');
        }
        await claimUpload(pathname, ticket!, 'upload');
        return {
          allowedContentTypes: ['application/zip'],
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          addRandomSuffix: false,
          allowOverwrite: false,
          validUntil: Date.now() + 15 * 60 * 1000,
        };
      },
    });
    return Response.json(result);
  } catch (error) {
    console.error('Unable to authorize upload:', error);
    return Response.json(
      {
        error:
          error instanceof SecurityError
            ? error.message
            : 'Unable to upload GTFS. Please start a new upload.',
      },
      { status: error instanceof SecurityError ? error.statusCode : 400 },
    );
  }
};

export const DELETE = async (request: Request) => {
  try {
    const { pathname, ticket } = await request.json();
    if (!verifyUploadTicket(pathname, ticket)) {
      return Response.json({ error: 'Invalid upload.' }, { status: 400 });
    }
    await deleteUpload(pathname);
    return new Response(null, { status: 204 });
  } catch {
    return Response.json(
      { error: 'Unable to clean up upload.' },
      { status: 400 },
    );
  }
};
