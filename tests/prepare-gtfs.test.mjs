import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { crc32, deflateRawSync } from 'node:zlib';
import {
  mkdtemp,
  rm,
  readFile,
  readdir,
  writeFile,
  stat,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareGtfs } from '../src/lib/prepare-gtfs.ts';
import { generateInWorker } from '../src/lib/generation-worker.ts';
import { createGenerationEventStream } from '../src/lib/generation-event-stream.ts';
import { readGenerationStream } from '../src/lib/read-generation-stream.ts';

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

test('unused files are skipped while maps and timetable extensions still generate', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'gtfs-filtered-'));
  const extensions = [
    [
      'shapes.txt',
      'shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence\nshape,45,-122,1\nshape,45.1,-122.1,2\n',
    ],
    [
      'route_attributes.txt',
      'route_id,category,subcategory,running_way\nr,3,101,1\n',
    ],
    ['stop_attributes.txt', 'stop_id,stop_city\ns1,Example City\n'],
    [
      'timetables.txt',
      'timetable_id,route_id,direction_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,timetable_label,timetable_page_id\ncustom,r,0,1,1,1,1,1,1,1,Custom Timetable,page\n',
    ],
    [
      'timetable_pages.txt',
      'timetable_page_id,timetable_page_label,filename\npage,Custom Page,custom.html\n',
    ],
    [
      'timetable_stop_order.txt',
      'timetable_id,stop_id,stop_sequence\ncustom,s1,1\ncustom,s2,2\n',
    ],
    [
      'timetable_notes.txt',
      'note_id,symbol,note\nnote,*,Retained timetable note\n',
    ],
    ['timetable_notes_references.txt', 'note_id,timetable_id\nnote,custom\n'],
  ];
  const unused = [
    [
      'directions.txt',
      'route_id,direction_id,direction\nr,0,Outbound\nr,0,Duplicate\n',
    ],
    ['fare_attributes.txt', 'Invalid fares data\n'],
    ['transfers.txt', 'Invalid transfers data\n'],
    ['translations.txt', 'Invalid translations data\n'],
    ['extra.csv', 'Unused agency data\n'],
  ];
  try {
    const archive = join(dir, 'input.zip');
    await writeFile(
      archive,
      zip([
        ...fixtures.map(([name, data]) => [
          name,
          name === 'trips.txt'
            ? 'route_id,service_id,trip_id,direction_id,shape_id\nr,svc,t,0,shape\n'
            : data,
        ]),
        ...extensions,
        ...unused,
      ]),
    );
    const signal = new AbortController().signal;
    const feed = await prepareGtfs(archive, join(dir, 'feed'), signal);
    assert.deepEqual(
      (await readdir(feed)).sort(),
      [...fixtures, ...extensions].map(([name]) => name).sort(),
    );
    for (const outputFormat of ['html', 'csv']) {
      const outputPath = join(dir, outputFormat);
      const output = await generateInWorker(
        {
          agencies: [{ agencyKey: 'test', path: feed }],
          outputPath,
          outputFormat,
          showMap: true,
          showStopCity: true,
        },
        dir,
        signal,
      );
      assert.ok((await stat(output)).size > 0);
      const generatedFiles = await readdir(outputPath, { recursive: true });
      if (outputFormat === 'html') {
        const page = generatedFiles.find((file) =>
          file.endsWith('/custom.html'),
        );
        assert.ok(page, await readFile(join(outputPath, 'log.txt'), 'utf8'));
        const html = await readFile(join(outputPath, page), 'utf8');
        assert.match(html, /Custom Timetable/);
        assert.match(html, /Retained timetable note/);
        assert.match(html, /Example City/);
        assert.match(html, /LineString/);
      } else {
        const csvFile = generatedFiles.find((file) => file.endsWith('.csv'));
        assert.ok(csvFile, await readFile(join(outputPath, 'log.txt'), 'utf8'));
        const csv = await readFile(join(outputPath, csvFile), 'utf8');
        assert.match(csv, /First/);
        assert.match(csv, /Second/);
      }
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('duplicate stops reach the client with the GTFS message, file and line', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'gtfs-duplicate-'));
  const logger = mock.method(console, 'error', () => {});
  try {
    const archive = join(dir, 'input.zip');
    await writeFile(
      archive,
      zip(
        fixtures.map(([name, data]) => [
          name,
          name === 'stops.txt' ? `${data}s1,Duplicate,45,-122\n` : data,
        ]),
      ),
    );
    const signal = new AbortController().signal;
    const feed = await prepareGtfs(archive, join(dir, 'feed'), signal);
    const { stream, finished } = createGenerationEventStream(
      {
        agencies: [{ agencyKey: 'test', path: feed }],
        outputPath: join(dir, 'output'),
        showMap: false,
      },
      dir,
      'output',
      signal,
      Date.now() + 30_000,
    );
    const result = await readGenerationStream(new Response(stream), () => {});
    assert.deepEqual(result, {
      error: 'stops.txt, line 3: UNIQUE constraint failed: stops.stop_id',
      code: 'GTFS_DB_OPERATION_FAILED',
      category: 'database',
    });
    assert.equal((await finished).complete, false);
    await assert.rejects(stat(dir), { code: 'ENOENT' });
  } finally {
    logger.mock.restore();
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
