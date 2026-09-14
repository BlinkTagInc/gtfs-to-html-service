import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createUploadTicket } from '../src/lib/upload-ticket.ts';
process.env.BLOB_READ_WRITE_TOKEN = 'test-only-secret';
const markers = new Set();
class BlobPreconditionFailedError extends Error {}
mock.module('@vercel/blob', {
  namedExports: {
    BlobPreconditionFailedError,
    put: async (path, body, options) => {
      assert.equal(options.allowOverwrite, false);
      assert.equal(options.addRandomSuffix, false);
      assert.equal(options.access, 'private');
      if (markers.has(path)) {
        throw new BlobPreconditionFailedError();
      }
      markers.add(path);
    },
    list: async () => ({ blobs: [], hasMore: false }),
    del: async () => {},
  },
});
const { claimUpload } = await import('../src/lib/upload-claims.ts');
test('one concurrent claimant wins each stage and later replays fail', async () => {
  const { pathname, ticket } = createUploadTicket();
  for (const stage of ['upload', 'generation']) {
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => claimUpload(pathname, ticket, stage)),
    );
    assert.equal(
      results.filter((result) => result.status === 'fulfilled').length,
      1,
    );
    assert.equal(
      results.filter(
        (result) =>
          result.status === 'rejected' && result.reason.statusCode === 409,
      ).length,
      9,
    );
    await assert.rejects(claimUpload(pathname, ticket, stage), {
      statusCode: 409,
    });
  }
  await assert.rejects(
    claimUpload(pathname, 'invalid', 'generation'),
    /Invalid/,
  );
});
