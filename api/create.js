const path = require('path');
const fs = require('fs');
const util = require('util')
const uuidV4 = require('uuid/v4');
const url = require('url');
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

module.exports = async (request, h) => {
  const body = request.payload;
  const buildId = uuidV4();

  const config = {
    verbose: true,
    zipOutput: true,
    mongoUrl: process.env.MONGODB_URI,
    agencies: [
      {
        agency_key: buildId,
        url: body.url
      }
    ]
  }

  const responseData = {
    id: buildId,
    original_gtfs_url: body.url,
  };

  try {
    await gtfsToHtml(config);
    const outputStats = await getOutputStats(path.join(__dirname, '..', 'html', buildId, 'log.txt'));

    return {
      ...responseData,
      outputStats,
      html_download_url: url.resolve(process.env.SERVER_URL, path.join('results', buildId, 'timetables.zip')),
      html_preview_url: url.resolve(process.env.SERVER_URL, path.join('results', buildId))
    };
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

    return h.response({
      ...responseData,
      error: errorMessage
    }).code(400);
  }
}
