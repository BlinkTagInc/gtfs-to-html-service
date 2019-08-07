const path = require('path');
const fs = require('fs');
const util = require('util');
const url = require('url');
var s3 = require('s3');
const gtfsToHtml = require('gtfs-to-html');
const readFile = util.promisify(fs.readFile);

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

module.exports = async (data, socket) => {
  const { buildId, url: downloadUrl } = data;
  const config = {
    verbose: true,
    zipOutput: true,
    mongoUrl: process.env.MONGODB_URI,
    agencies: [
      {
        agency_key: buildId,
        url: downloadUrl
      }
    ],
    logFunction: text => {
      socket.emit('status', { status: text });
    },
    dataExpireAfterSeconds: 3600
  }

  try {
    await gtfsToHtml(config);
    const outputStats = await getOutputStats(path.join(__dirname, '..', 'html', buildId, 'log.txt'));

    socket.emit('status', { status: `Finished creating ${outputStats['Timetable Count']} timetables` });

    // Set expires date to 30 days in the future
    const uploader = client.uploadDir({
      localDir: path.join(__dirname, '..', 'html', buildId),
      deleteRemoved: true,
      s3Params: {
        Bucket: 'gtfs-to-html',
        Prefix: buildId,
        ACL: 'public-read',
        Expires: new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000)
      }
    });

    uploader.on('error', function(error) {
      throw error;
    });

    uploader.on('progress', function() {
      const progressPercent = uploader.progressAmount ? `[${Math.round(uploader.progressAmount / uploader.progressTotal * 1000) / 10}%]` : '';
      socket.emit('status', {
        status: `Uploading timetables ${progressPercent}`,
        statusKey: 'uploading'
      });
    });
    
    uploader.on('end', function() {
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
      errorMessage = `Unable to fetch GTFS from ${body.url}`;
    } else if (error.toString().includes('Unable to unzip file')) {
      errorMessage = `Invalid zip file at ${body.url}`;
    } else {
      errorMessage = error.toString();
    }

    socket.emit('status', { error: errorMessage });
  }
}
