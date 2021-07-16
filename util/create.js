const path = require('path');
const fetch = require('node-fetch');
const fs = require('fs-extra');
const util = require('util');
const url = require('url');
var s3 = require('@auth0/s3');
const gtfsToHtml = require('gtfs-to-html');
const readFile = util.promisify(fs.readFile);
const tmp = require('tmp-promise');

async function getOutputStats(statsPath) {
  const outputStatsText = await readFile(statsPath, 'utf8');
  return outputStatsText.split('\n').reduce((memo, stat) => {
    const parts = stat.split(':');
    memo[parts.shift()] = parts.join(':').trim();
    return memo;
  }, {});
}

var client = s3.createClient({
  s3Options: {
    accessKeyId: process.env.GTFS_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.GTFS_AWS_ACCESS_KEY_SECRET,
    region: process.env.GTFS_AWS_REGION
  },
});

const maxGTFSSize = 10000000;

const downloadAndUnzip = async (downloadUrl, buildId) => {
  const { path, cleanup } = await tmp.dir({ unsafeCleanup: true });
  const downloadPath = `${path}/${buildId}-gtfs.zip`;

  const res = await fetch(downloadUrl, { method: 'GET' });

  if (res.status !== 200) {
    throw new Error('Couldn\'t download files');
  }

  const buffer = await res.buffer();

  await fs.writeFile(downloadPath, buffer);

  const stats = await fs.stat(downloadPath);

  if (stats.size > maxGTFSSize) {
    throw new Error('GTFS Zip file too large for gtfstohtml.com. Try running gtfs-to-html on your local machine for processing large GTFS files. Learn more at https://github.com/BlinkTagInc/gtfs-to-html');
  }

  return downloadPath;
}

const createTimetables = async (data, socket) => {
  const {
    buildId,
    url: downloadUrl,
    options = {}
  } = data;

  try {
    const downloadPath = await downloadAndUnzip(downloadUrl, buildId);
  
    const config = {
      ...options,
      verbose: true,
      zipOutput: true,
      agencies: [{
        agency_key: buildId,
        path: downloadPath
      }],
      logFunction: text => {
        socket.emit('status', {
          status: text
        });
      },
      dataExpireAfterSeconds: 1200
    }

    await gtfsToHtml(config);
    const outputStats = await getOutputStats(path.join(__dirname, '..', 'html', buildId, 'log.txt'));

    socket.emit('status', {
      status: `Finished creating ${outputStats['Timetable Count']} timetables`
    });

    // Set expires date to 30 days in the future
    const uploader = client.uploadDir({
      localDir: path.join(__dirname, '..', 'html', buildId),
      deleteRemoved: true,
      s3Params: {
        Bucket: 'gtfstohtml',
        Prefix: buildId,
        ACL: 'public-read',
        Expires: new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000)
      }
    });

    uploader.on('error', function (error) {
      throw error;
    });

    uploader.on('progress', function () {
      const progressPercent = uploader.progressAmount ? `[${Math.round(uploader.progressAmount / uploader.progressTotal * 1000) / 10}%]` : '';
      socket.emit('status', {
        status: `Uploading timetables ${progressPercent}`,
        statusKey: 'uploading'
      });
    });

    uploader.on('end', function () {
      socket.emit('status', {
        status: 'Timetable upload completed',
        html_download_url: url.resolve(process.env.GTFS_AWS_S3_URL, path.join(buildId, 'timetables.zip')),
        html_preview_url: url.resolve(process.env.GTFS_AWS_S3_URL, path.join(buildId, 'index.html'))
      });
    });

  } catch (error) {
    console.log(error)
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
}

const createTimetablesSocketless = async (data) => {
  const {
    buildId,
    url: downloadUrl,
    options = {}
  } = data;

  try {

    const downloadPath = await downloadAndUnzip(downloadUrl, buildId);
    
    const config = {
      ...options,
      verbose: true,
      zipOutput: true,
      agencies: [{
        agency_key: buildId,
        path: downloadPath
      }],
      dataExpireAfterSeconds: 1200
    }

    await gtfsToHtml(config);
    const outputStats = await getOutputStats(path.join(__dirname, '..', 'html', buildId, 'log.txt'));

    console.log(`Finished creating ${outputStats['Timetable Count']} timetables`)

    // Set expires date to 30 days in the future
    const uploader = client.uploadDir({
      localDir: path.join(__dirname, '..', 'html', buildId),
      deleteRemoved: true,
      s3Params: {
        Bucket: 'gtfstohtml',
        Prefix: buildId,
        ACL: 'public-read',
        Expires: new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000)
      }
    });

    uploader.on('error', function (error) {
      throw error;
    });

    uploader.on('progress', function () {
      const progressPercent = uploader.progressAmount ? `[${Math.round(uploader.progressAmount / uploader.progressTotal * 1000) / 10}%]` : '';
      console.log(`Uploading timetables ${progressPercent}`)
    });

    return new Promise((resolve) => {
      uploader.on('end', function () {
        resolve({
          status: 'Timetable upload completed',
          html_download_url: url.resolve(process.env.GTFS_AWS_S3_URL, path.join(buildId, 'timetables.zip')),
          html_preview_url: url.resolve(process.env.GTFS_AWS_S3_URL, path.join(buildId, 'index.html'))
        });
      });
    })
  } catch (error) {
    console.log(error)
    let errorMessage;

    if (error.toString().includes('FetchError')) {
      errorMessage = `Unable to fetch GTFS from ${downloadUrl}`;
    } else if (error.toString().includes('Unable to unzip file')) {
      errorMessage = `Invalid zip file at ${downloadUrl}`;
    } else {
      errorMessage = error.toString().replace('Error: ', '');
    }

    return {
      error: errorMessage
    };
  }
}

module.exports = {
  createTimetables,
  createTimetablesSocketless
}