import {join} from 'node:path';
import {fileURLToPath, resolve} from 'node:url';
import {readFile, stat, writeFile} from 'node:fs/promises';
import fetch from 'node-fetch';
import { throttle } from 'lodash-es';

import {createClient} from '@auth0/s3';
import gtfsToHtml from 'gtfs-to-html';
import {dir} from 'tmp-promise';

async function getOutputStats(statsPath) {
  const outputStatsText = await readFile(statsPath, 'utf8');
  return outputStatsText.split('\n').reduce((memo, statistic) => {
    const parts = statistic.split(':');
    memo[parts.shift()] = parts.join(':').trim();
    return memo;
  }, {});
}

const client = createClient({
  s3Options: {
    accessKeyId: process.env.GTFS_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.GTFS_AWS_ACCESS_KEY_SECRET,
    region: process.env.GTFS_AWS_REGION
  }
});

const maxGTFSSize = 10_000_000;

const downloadAndUnzip = async (downloadUrl, buildId) => {
  const {path, cleanup} = await dir({unsafeCleanup: true});
  const downloadPath = `${path}/${buildId}-gtfs.zip`;

  const res = await fetch(downloadUrl, {method: 'GET'});

  if (res.status !== 200) {
    throw new Error('Couldn\'t download files');
  }

  const buffer = await res.buffer();

  await writeFile(downloadPath, buffer);

  const stats = await stat(downloadPath);

  if (stats.size > maxGTFSSize) {
    throw new Error('GTFS Zip file too large for gtfstohtml.com. Try running gtfs-to-html on your local machine for processing large GTFS files. Learn more at https://github.com/BlinkTagInc/gtfs-to-html');
  }

  return downloadPath;
};

export default async (data, socket) => {
  const {
    buildId,
    url: downloadUrl,
    options = {}
  } = data;

  try {
    const downloadPath = await downloadAndUnzip(downloadUrl, buildId);

    const throttledLog = throttle((text, overwrite) => {
      socket.emit('status', {
        status: text,
        overwrite
      });
    }, 500);

    const logFunction = (text, overwrite) => {
      if (overwrite === true) {
        throttledLog(text, overwrite);
      } else {
        socket.emit('status', {
          status: text,
          overwrite
        });
      }
    };

    const config = {
      ...options,
      verbose: true,
      zipOutput: true,
      agencies: [{
        agency_key: buildId,
        path: downloadPath
      }],
      logFunction
    };

    // Use test mapbox access token if none provided
    if (config.showMap && (!config.mapboxAccessToken || config.mapboxAccessToken === 'PUT YOUR MAPBOX ACCESS TOKEN HERE')) {
      config.mapboxAccessToken = 'pk.eyJ1IjoiYnJlbmRhbm5lZSIsImEiOiJjaXRkMWIzbzEwMDV5MnRvMzJwbjRiaWc3In0.smzRW-NB_BCAGAQiEOvJdg';
    }

    await gtfsToHtml(config);
    const outputStats = await getOutputStats(join(fileURLToPath(import.meta.url), '../../html', buildId, 'log.txt'));

    config.logFunction(`Finished creating ${outputStats['Timetable Count']} timetables`);
  
    // Set expires date to 30 days in the future
    const uploader = client.uploadDir({
      localDir: join(fileURLToPath(import.meta.url), '../../html', buildId),
      deleteRemoved: true,
      s3Params: {
        Bucket: 'gtfs-to-html',
        Prefix: buildId,
        ACL: 'public-read',
        Expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });

    uploader.on('error', error => {
      throw error;
    });

    uploader.on('progress', () => {
      const progressPercent = uploader.progressAmount ? `[${Math.round(uploader.progressAmount / uploader.progressTotal * 1000) / 10}%]` : '';
      logFunction(`Uploading timetables ${progressPercent}`, true);
    });

    uploader.on('end', () => {
      setTimeout(() => {
        socket.emit('status', {
          status: 'Timetable upload completed',
          html_download_url: resolve(process.env.GTFS_AWS_S3_URL, join(buildId, 'timetables.zip')),
          html_preview_url: resolve(process.env.GTFS_AWS_S3_URL, join(buildId, 'index.html'))
        });
      }, 1000);
    });
  } catch (error) {
    console.log(error);
    let errorMessage;

    if (error.toString().includes('FetchError')) {
      errorMessage = `Unable to fetch GTFS from ${downloadUrl}`;
    } else if (error.toString().includes('Unable to unzip file')) {
      errorMessage = `Invalid zip file at ${downloadUrl}`;
    } else {
      errorMessage = error.toString().replace('Error: ', '');
    }

    socket.emit('status', {
      error: errorMessage
    });
  }
};
