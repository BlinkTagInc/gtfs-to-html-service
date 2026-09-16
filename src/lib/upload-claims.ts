import { put, list, del, BlobPreconditionFailedError } from '@vercel/blob';
import { verifyUploadTicket } from './upload-ticket.ts';
import { SecurityError } from './security-error.ts';

export const CLAIM_PREFIX = 'gtfs-claims/';

export const claimUpload = async (
  pathname: string,
  ticket: string,
  stage: 'upload' | 'generation',
) => {
  if (!verifyUploadTicket(pathname, ticket)) {
    throw new SecurityError('Invalid or expired upload ticket.');
  }
  try {
    // Blob's conditional create (If-None-Match) arbitrates concurrent callers
    // across instances. Never delete these markers while tickets are valid.
    // Use an empty buffer because the SDK rejects an empty string as missing.
    await put(
      `${CLAIM_PREFIX}${pathname.slice('gtfs-uploads/'.length)}.${stage}`,
      Buffer.alloc(0),
      {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: false,
        abortSignal: AbortSignal.timeout(10_000),
      },
    );
  } catch (error) {
    if (
      error instanceof BlobPreconditionFailedError ||
      (error instanceof Error && /already exists/i.test(error.message))
    ) {
      throw new SecurityError(
        'This upload ticket has already been used. Please start a new upload.',
        409,
      );
    }
    throw error;
  }
};

export const cleanupUploadClaims = async () => {
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: CLAIM_PREFIX, cursor, limit: 1000 });
    const stale = page.blobs.filter(
      (blob) => blob.uploadedAt.getTime() < Date.now() - 24 * 60 * 60 * 1000,
    );
    if (stale.length) {
      await del(stale.map((blob) => blob.url));
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
};
