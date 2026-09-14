import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crc32, deflateRawSync } from 'node:zlib';
import { mkdtemp, rm, readFile, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareGtfs } from '../src/lib/prepare-gtfs.ts';
import { generateInWorker } from '../src/lib/generation-worker.ts';

// Minimal ZIP fixture builder, including deliberately dishonest size metadata.
const zip = (files) => {
  const local = [];
  const central = [];
  let offset = 0;
  for (const [name, text, declaredSize] of files) {
    const filename = Buffer.from(name);
    const data = Buffer.from(text);
    const compressed = deflateRawSync(data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(8, 8);
    header.writeUInt32LE(crc32(data), 14);
    header.writeUInt32LE(compressed.length, 18);
    header.writeUInt32LE(declaredSize ?? data.length, 22);
    header.writeUInt16LE(filename.length, 26);
    local.push(header, filename, compressed);
    const record = Buffer.alloc(46);
    record.writeUInt32LE(0x02014b50);
    record.writeUInt16LE(20, 4);
    header.copy(record, 6, 4, 30);
    record.writeUInt32LE(offset, 42);
    central.push(record, filename);
    offset += header.length + filename.length + compressed.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
};
const fixtures = [
  [
    'agency.txt',
    'agency_id,agency_name,agency_url,agency_timezone\na,Test Transit,https://example.com,America/Los_Angeles\n',
  ],
  [
    'routes.txt',
    'route_id,agency_id,route_short_name,route_long_name,route_type\nr,a,1,Test Route,3\n',
  ],
  [
    'stops.txt',
    'stop_id,stop_name,stop_lat,stop_lon\ns1,First,45,-122\ns2,Second,45.1,-122.1\n',
  ],
  ['trips.txt', 'route_id,service_id,trip_id,direction_id\nr,svc,t,0\n'],
  [
    'stop_times.txt',
    'trip_id,arrival_time,departure_time,stop_id,stop_sequence\nt,10:00:00,10:00:00,s1,1\nt,10:10:00,10:10:00,s2,2\n',
  ],
  [
    'calendar.txt',
    'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\nsvc,1,1,1,1,1,1,1,20260101,20271231\n',
  ],
];

test('real ZIP feed extracts one folder and generates HTML in the worker', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'gtfs-safe-'));
  try {
    const archive = join(dir, 'input.zip');
    await writeFile(
      archive,
      zip(fixtures.map(([name, data]) => [`feed/${name}`, data])),
    );
    const feed = await prepareGtfs(
      archive,
      join(dir, 'feed'),
      new AbortController().signal,
    );
    assert.match(
      await readFile(join(feed, 'agency.txt'), 'utf8'),
      /Test Transit/,
    );
    await assert.rejects(stat(archive), { code: 'ENOENT' });
    const output = await generateInWorker(
      {
        agencies: [{ agencyKey: 'test', path: feed }],
        outputPath: join(dir, 'output'),
        showMap: false,
      },
      dir,
      new AbortController().signal,
    );
    assert.ok((await stat(output)).size > 0);
    assert.match(
      await readFile(join(dir, 'output', 'index.html'), 'utf8'),
      /Test Transit/,
    );
    await assert.rejects(
      generateInWorker(
        { outputFormat: 'pdf' },
        dir,
        new AbortController().signal,
      ),
      { code: 'PDF_DISABLED' },
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('ZIP preparation rejects traversal, duplicates, expansion, entry and line excess', async () => {
  for (const files of [
    [['../agency.txt', 'bad']],
    [
      ['agency.txt', 'a'],
      ['AGENCY.txt', 'b'],
    ],
    [['agency.txt', 'a', 200_000_001]],
    Array.from({ length: 101 }, (_, index) => [`${index}.txt`, 'a']),
    [['agency.txt', '\n'.repeat(3_000_001)]],
  ]) {
    const dir = await mkdtemp(join(tmpdir(), 'gtfs-reject-'));
    try {
      const archive = join(dir, 'input.zip');
      await writeFile(archive, zip(files));
      await assert.rejects(
        prepareGtfs(archive, join(dir, 'feed'), new AbortController().signal),
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
});
