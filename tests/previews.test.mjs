import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  previewExpiry,
  PREVIEW_LIFETIME_MS,
  safePreviewPath,
  previewHeaders,
} from '../src/lib/preview-policy.ts';

const objects = new Map();
let failUpload = false;
mock.module('@vercel/blob', {
  namedExports: {
    put: async (pathname, stream, options) => {
      assert.equal(options.access, 'private');
      if (failUpload && pathname.endsWith('.css')) {
        throw new Error('Simulated publication failure');
      }
      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      objects.set(pathname, Buffer.concat(chunks));
      return { pathname };
    },
    list: async ({ prefix }) => ({
      hasMore: false,
      blobs: [...objects.keys()]
        .filter((p) => p.startsWith(prefix))
        .map((pathname) => ({ pathname, url: pathname })),
    }),
    del: async (paths) => {
      for (const path of paths) {
        objects.delete(path);
      }
    },
  },
});
const { publishPreview, cleanupPreviews } =
  await import('../src/lib/timetable-preview.ts');

test('preview identifiers expire at 48 hours and reject forged paths', () => {
  const created = Date.now() - PREVIEW_LIFETIME_MS;
  assert.equal(
    previewExpiry(`${created}-${'a'.repeat(48)}`),
    created + PREVIEW_LIFETIME_MS,
  );
  assert.equal(previewExpiry('guessable'), null);
  assert.equal(previewExpiry(`${Date.now() + 10000}-${'a'.repeat(48)}`), null);
  for (const parts of [
    ['..'],
    ['assets', '../secret'],
    ['a\\b'],
    ['a\0b'],
    [],
  ]) {
    assert.equal(safePreviewPath(parts), false);
  }
  assert.equal(safePreviewPath(['nested', 'weekday.html']), true);
  const headers = previewHeaders('index.html');
  assert.equal(headers['Cache-Control'], 'no-store');
  assert.match(headers['Content-Security-Policy'], /sandbox allow-scripts/);
  assert.doesNotMatch(headers['Content-Security-Policy'], /allow-same-origin/);
  assert.equal(
    previewHeaders('main.js')['Content-Type'],
    'text/javascript; charset=utf-8',
  );
});

test('publishes nested assets and ZIP, omits logs, rolls back failures and expires old objects', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'preview-test-'));
  try {
    await mkdir(join(dir, 'css'));
    await writeFile(
      join(dir, 'index.html'),
      '<link href="css/main.css">Timetables',
    );
    await writeFile(join(dir, 'css/main.css'), 'body { color: green; }');
    await writeFile(join(dir, 'timetables.zip'), 'zip-fixture');
    await writeFile(join(dir, 'log.txt'), 'internal paths');
    const preview = await publishPreview(dir, new AbortController().signal);
    assert.match(preview.url, /^\/preview\/\d{13}-[a-f0-9]{48}\/index.html$/);
    assert.equal(objects.size, 3);
    assert.equal(
      [...objects.keys()].some((p) => p.endsWith('/log.txt')),
      false,
    );
    failUpload = true;
    await assert.rejects(
      publishPreview(dir, new AbortController().signal),
      /Simulated/,
    );
    assert.equal(objects.size, 3);
    const oldId = `${Date.now() - PREVIEW_LIFETIME_MS - 1}-${'b'.repeat(48)}`;
    objects.set(`timetable-previews/${oldId}/index.html`, Buffer.from('old'));
    objects.set('gtfs-uploads/leave-alone.zip', Buffer.from('input'));
    assert.equal(await cleanupPreviews(), 1);
    assert.equal(objects.size, 4);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
