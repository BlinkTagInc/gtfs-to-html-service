import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createUploadTicket,
  verifyUploadTicket,
} from '../src/lib/upload-ticket.ts';
import { MAX_UPLOAD_BYTES } from '../src/lib/upload-limits.ts';

process.env.BLOB_READ_WRITE_TOKEN = 'test-only-secret';

test('tickets bind a unique pathname, reject tampering and expire', () => {
  const first = createUploadTicket();
  const second = createUploadTicket();
  assert.notEqual(first.pathname, second.pathname);
  assert.equal(verifyUploadTicket(first.pathname, first.ticket), true);
  assert.equal(verifyUploadTicket(second.pathname, first.ticket), false);
  assert.equal(
    verifyUploadTicket('https://example.com/input.zip', first.ticket),
    false,
  );
  assert.equal(verifyUploadTicket('../input.zip', first.ticket), false);
  assert.equal(verifyUploadTicket(first.pathname, 'invalid'), false);
  const now = mock.method(
    Date,
    'now',
    () => Number(first.ticket.split('.')[0]) + 1,
  );
  try {
    assert.equal(verifyUploadTicket(first.pathname, first.ticket), false);
  } finally {
    now.mock.restore();
  }
});

let blobResult;
let deleteFails = false;
const deleted = [];
mock.module('@vercel/blob', {
  namedExports: {
    get: async () => blobResult,
    put: async (pathname, body, options) => {
      assert.equal(body.length, 0);
      assert.equal(options.allowOverwrite, true);
      assert.equal(options.addRandomSuffix, false);
      assert.equal(options.access, 'private');
      assert.equal(options.abortSignal.aborted, false);
      deleted.push(pathname);
      if (deleteFails) {
        throw new Error('Simulated Blob outage');
      }
    },
  },
});
const { downloadUpload, deleteUpload } =
  await import('../src/lib/blob-upload.ts');

const makeBlob = (size, actualSize = size) => ({
  statusCode: 200,
  blob: { size },
  stream: new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(actualSize));
      controller.close();
    },
  }),
});

test('download accepts exactly 50 MB and rejects excess metadata and actual bytes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'blob-upload-test-'));
  try {
    blobResult = makeBlob(MAX_UPLOAD_BYTES);
    await downloadUpload(
      'test.zip',
      join(dir, 'valid.zip'),
      new AbortController().signal,
    );
    assert.equal((await stat(join(dir, 'valid.zip'))).size, MAX_UPLOAD_BYTES);
    blobResult = makeBlob(MAX_UPLOAD_BYTES + 1, 1);
    await assert.rejects(
      downloadUpload(
        'test.zip',
        join(dir, 'large.zip'),
        new AbortController().signal,
      ),
      /exceeds 50 MB/,
    );
    blobResult = makeBlob(1, MAX_UPLOAD_BYTES + 1);
    await assert.rejects(
      downloadUpload(
        'test.zip',
        join(dir, 'lying.zip'),
        new AbortController().signal,
      ),
      /exceeds 50 MB/,
    );
    blobResult = null;
    await assert.rejects(
      downloadUpload(
        'test.zip',
        join(dir, 'missing.zip'),
        new AbortController().signal,
      ),
      /unavailable/,
    );
    blobResult = makeBlob(1);
    await assert.rejects(
      downloadUpload('test.zip', join(dir, 'aborted.zip'), AbortSignal.abort()),
      { name: 'AbortError' },
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('empty tombstones have their own timeout and failure does not discard generation', async () => {
  await deleteUpload('test.zip');
  assert.deepEqual(deleted, ['test.zip']);
  deleteFails = true;
  const logger = mock.method(console, 'error', () => {});
  try {
    await deleteUpload('retry-by-cron.zip');
    assert.equal(logger.mock.callCount(), 1);
  } finally {
    logger.mock.restore();
  }
});
