import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
import { mkdtemp, rm, readFile, writeFile, truncate } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let addresses = [{ address: '8.8.8.8', family: 4 }];
let responses = [];
let requests = 0;
mock.module('node:dns/promises', {
  namedExports: { lookup: async () => addresses },
});
const request = (url, options, callback) => {
  requests++;
  assert.equal(url.hostname, 'feed.example');
  options.lookup(url.hostname, { all: true }, (error, results) => {
    assert.equal(error, null);
    assert.deepEqual(results, [addresses[0]]);
  });
  const emitter = new EventEmitter();
  emitter.end = () => callback(responses.shift());
  return emitter;
};
mock.module('node:http', { namedExports: { request } });
mock.module('node:https', { namedExports: { request } });
const { validateDownloadUrl, isPublicAddress, downloadPublicGtfs } =
  await import('../src/lib/safe-download.ts');
const response = (data, headers = {}, statusCode = 200) =>
  Object.assign(Readable.from(data), { headers, statusCode });

test('URL validation rejects private, mapped, reserved and alternate-form IPs', () => {
  for (const address of [
    '127.0.0.1',
    '10.0.0.1',
    '169.254.169.254',
    '100.64.0.1',
    '192.168.0.1',
    '172.16.0.1',
    '::1',
    '::ffff:127.0.0.1',
    'fc00::1',
    'fe80::1',
    '192.0.2.1',
  ]) {
    assert.equal(isPublicAddress(address), false, address);
  }
  for (const url of [
    'http://2130706433/x',
    'http://0x7f000001/x',
    'http://[::1]/',
    'file:///etc/passwd',
    'https://user:secret@feed.example/',
    'http://feed.example:8080/',
  ]) {
    assert.throws(() => validateDownloadUrl(url));
  }
  assert.equal(isPublicAddress('8.8.8.8'), true);
  assert.equal(isPublicAddress('2606:4700:4700::1111'), true);
});

test('downloads pin public DNS and bound redirects, declared and actual bytes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'safe-download-'));
  try {
    responses = [response([Buffer.from('zip')])];
    await downloadPublicGtfs(
      'https://feed.example/feed.zip',
      join(dir, 'ok'),
      new AbortController().signal,
    );
    assert.equal(await readFile(join(dir, 'ok'), 'utf8'), 'zip');
    responses = [response([], { location: 'http://169.254.169.254/' }, 302)];
    await assert.rejects(
      downloadPublicGtfs(
        'https://feed.example/',
        join(dir, 'redirect'),
        new AbortController().signal,
      ),
      /public internet/,
    );
    responses = [response([], { 'content-length': '50000001' })];
    await assert.rejects(
      downloadPublicGtfs(
        'https://feed.example/',
        join(dir, 'metadata'),
        new AbortController().signal,
      ),
      /50 MB/,
    );
    responses = [response([Buffer.alloc(50_000_001)], {})];
    await assert.rejects(
      downloadPublicGtfs(
        'https://feed.example/',
        join(dir, 'actual'),
        new AbortController().signal,
      ),
      /50 MB/,
    );
    const before = requests;
    addresses = [
      { address: '8.8.8.8', family: 4 },
      { address: '10.0.0.1', family: 4 },
    ];
    await assert.rejects(
      downloadPublicGtfs(
        'https://feed.example/',
        join(dir, 'mixed'),
        new AbortController().signal,
      ),
      /public internet/,
    );
    assert.equal(requests, before);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

const { checkGenerationResources } =
  await import('../src/lib/generation-resource-limits.ts');
test('generation budget detects oversized output', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'generation-budget-'));
  try {
    await writeFile(join(dir, 'output'), '');
    await checkGenerationResources(dir);
    await truncate(join(dir, 'output'), 400_000_001);
    await assert.rejects(checkGenerationResources(dir), {
      code: 'GENERATION_RESOURCE_LIMIT',
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

const { reserveGeneration, cleanupGeneration } =
  await import('../src/lib/generation-files.ts');
test('admission covers preprocessing and losing cleanup cannot release the active job', async () => {
  const winner = await mkdtemp(join(tmpdir(), 'admission-winner-'));
  const loser = await mkdtemp(join(tmpdir(), 'admission-loser-'));
  try {
    reserveGeneration(winner);
    assert.throws(() => reserveGeneration(loser), { code: 'GENERATION_BUSY' });
    await cleanupGeneration(loser);
    assert.throws(() => reserveGeneration(loser), { code: 'GENERATION_BUSY' });
    await cleanupGeneration(winner);
    reserveGeneration(loser);
  } finally {
    await cleanupGeneration(winner);
    await cleanupGeneration(loser);
  }
});
