import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GtfsError, GtfsErrorCode, GtfsToHtmlError } from 'gtfs-to-html';
import { getPublicGtfsErrorResponse } from '../src/lib/gtfs-error.ts';

test('known GTFS errors retain their messages, codes and categories', () => {
  for (const [ErrorClass, cases] of [
    [
      GtfsError,
      [
        ['GTFS_DATABASE_OPERATION_FAILED', 'database'],
        ['GTFS_CSV_PARSE_FAILED', 'parse'],
        ['GTFS_VALIDATION_FAILED', 'validation'],
      ],
    ],
    [
      GtfsToHtmlError,
      [
        ['GTFS_TO_HTML_QUERY_INVALID', 'query'],
        ['GTFS_TO_HTML_TIMETABLE_GENERATION_FAILED', 'internal'],
      ],
    ],
  ]) {
    for (const [code, category] of cases) {
      const error = new ErrorClass('Specific GTFS failure', {
        code,
        category,
      });
      // Workers reconstruct an Error with the library's custom fields.
      const reconstructed = Object.assign(new Error(error.message), error);
      for (const candidate of [error, reconstructed]) {
        assert.deepEqual(getPublicGtfsErrorResponse(candidate), {
          error: 'Specific GTFS failure',
          code,
          category,
          statusCode: 400,
        });
      }
    }
  }
});

test('database startup errors retain their message and server status', () => {
  for (const [ErrorClass, code] of [
    [GtfsError, 'GTFS_DATABASE_OPEN_FAILED'],
    [GtfsToHtmlError, 'GTFS_TO_HTML_DATABASE_OPEN_FAILED'],
  ]) {
    const result = getPublicGtfsErrorResponse(
      new ErrorClass('Unable to open database', { code, category: 'database' }),
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

test('HTTP download failures preserve upstream status and map the response status', () => {
  for (const status of [403, 404, 500, 503]) {
    for (const statusFields of [{ statusCode: status }, {}]) {
      const error = new GtfsError('Source download failed', {
        code: GtfsErrorCode.DOWNLOAD_HTTP_FAILED,
        category: 'download',
        ...statusFields,
        details: { url: 'https://example.com/feed.zip', status },
      });
      const reconstructed = Object.assign(new Error(error.message), error);
      for (const candidate of [error, reconstructed]) {
        const result = getPublicGtfsErrorResponse(candidate);
        assert.equal(result.code, 'DOWNLOAD_HTTP_ERROR');
        assert.equal(result.category, 'download');
        assert.equal(result.statusCode, status >= 500 ? 502 : 400);
        assert.match(result.error, new RegExp(`HTTP ${status}`));
        assert.match(result.error, /https:\/\/example.com\/feed.zip/);
      }
    }
  }
});

test('unknown errors still use the generic server response', () => {
  const result = getPublicGtfsErrorResponse(
    new Error('Private implementation detail'),
  );
  assert.equal(result.code, 'SERVER_ERROR');
  assert.equal(result.statusCode, 500);
  assert.doesNotMatch(result.error, /Private implementation detail/);
});
