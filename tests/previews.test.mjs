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
const uploadedTimes = new Map();
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
      uploadedTimes.set(pathname, new Date());
      return { pathname };
    },
    list: async ({ prefix }) => ({
      hasMore: false,
      blobs: [...objects.keys()]
        .filter((p) => p.startsWith(prefix))
        .map((pathname) => ({
          pathname,
          url: pathname,
          uploadedAt: uploadedTimes.get(pathname),
        })),
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

test('dated agency identifiers validate dates and expire 48 hours after upload', () => {
  const uploadedAt = new Date('2026-01-15T18:45:00Z');
  const id = 'mvgo-2026-01-15-aca6142231e8fed0';
  assert.equal(
    previewExpiry(id, uploadedAt),
    uploadedAt.getTime() + PREVIEW_LIFETIME_MS,
  );
  assert.equal(previewExpiry(id), Date.parse('2026-01-18T00:00:00Z'));
  for (const invalid of [
    'mvgo-2026-02-30-aca6142231e8fed0',
    'mvgo-2026-13-15-aca6142231e8fed0',
    'mvgo-2999-01-15-aca6142231e8fed0',
    'mvgo-2026-01-15-aca614',
    '../mvgo-2026-01-15-aca6142231e8fed0',
  ]) {
    assert.equal(previewExpiry(invalid), null);
  }
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
    const preview = await publishPreview(
      dir,
      new AbortController().signal,
      'MVGO',
    );
    assert.match(
      preview.url,
      /^\/preview\/mvgo-\d{4}-\d{2}-\d{2}-[a-f0-9]{16}\/index.html$/,
    );
    assert.equal(
      preview.downloadUrl,
      preview.url.replace('index.html', 'mvgo-timetables.zip'),
    );
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
    const expiredPath =
      'timetable-previews/mvgo-2026-01-15-aca6142231e8fed0/index.html';
    objects.set(expiredPath, Buffer.from('old'));
    uploadedTimes.set(
      expiredPath,
      new Date(Date.now() - PREVIEW_LIFETIME_MS - 1),
    );
    objects.set('gtfs-uploads/leave-alone.zip', Buffer.from('input'));
    assert.equal(await cleanupPreviews(), 2);
    assert.equal(objects.size, 4);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
