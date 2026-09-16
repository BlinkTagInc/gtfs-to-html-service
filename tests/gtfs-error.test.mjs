import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GtfsError, GtfsToHtmlError } from 'gtfs-to-html';
import { getPublicGtfsErrorResponse } from '../src/lib/gtfs-error.ts';

test('known GTFS errors retain their messages, codes and categories', () => {
  for (const ErrorClass of [GtfsError, GtfsToHtmlError]) {
    for (const category of ['database', 'parse', 'validation', 'internal']) {
      const error = new ErrorClass('Specific GTFS failure', {
        code: 'GTFS_TEST_FAILURE',
        category,
      });
      // Workers reconstruct an Error with the library's custom fields.
      const reconstructed = Object.assign(new Error(error.message), error);
      for (const candidate of [error, reconstructed]) {
        assert.deepEqual(getPublicGtfsErrorResponse(candidate), {
          error: 'Specific GTFS failure',
          code: 'GTFS_TEST_FAILURE',
          category,
          statusCode: 400,
        });
      }
    }
  }
});

test('database startup errors retain their message and server status', () => {
  for (const code of [
    'DB_OPEN_FAILED',
    'GTFS_DATABASE_OPEN_FAILED',
    'GTFS_TO_HTML_DATABASE_OPEN_FAILED',
  ]) {
    const result = getPublicGtfsErrorResponse(
      new GtfsError('Unable to open database', { code, category: 'database' }),
    );
    assert.equal(result.error, 'Unable to open database');
    assert.equal(result.statusCode, 500);
  }
});

test('feed location is exposed without private paths, details or stack traces', () => {
  const result = getPublicGtfsErrorResponse(
    new GtfsError(
      'Invalid record in /tmp/private-feed/input.txt\n    at internal.js:1',
      {
        code: 'GTFS_CSV_PARSE_FAILED',
        category: 'parse',
        details: {
          file: '/tmp/private-feed/directions.txt',
          line: 3,
          agencyPath: '/tmp/private-feed',
          sqlitePath: ':memory:',
        },
      },
    ),
  );
  assert.equal(
    result.error,
    'directions.txt, line 3: Invalid record in [temporary file]',
  );
  assert.doesNotMatch(
    JSON.stringify(result),
    /private-feed|internal.js|sqlitePath|agencyPath/,
  );
});

test('download errors preserve the original message and helpful timeout context', () => {
  const result = getPublicGtfsErrorResponse(
    new GtfsError('Specific source download failed', {
      code: 'GTFS_DOWNLOAD_FAILED',
      category: 'download',
      details: { url: 'https://example.com/feed.zip' },
      cause: new DOMException('Timed out', 'TimeoutError'),
    }),
  );
  assert.match(result.error, /Specific source download failed/);
  assert.match(result.error, /Timed out while trying to download GTFS/);
  assert.match(result.error, /https:\/\/example.com\/feed.zip/);
  assert.equal(result.code, 'DOWNLOAD_TIMEOUT');
});

test('unknown errors still use the generic server response', () => {
  const result = getPublicGtfsErrorResponse(
    new Error('Private implementation detail'),
  );
  assert.equal(result.code, 'SERVER_ERROR');
  assert.equal(result.statusCode, 500);
  assert.doesNotMatch(result.error, /Private implementation detail/);
});
