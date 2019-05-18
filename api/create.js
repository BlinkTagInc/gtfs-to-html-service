const path = require('path');
const uuidV4 = require('uuid/v4');
const url = require('url');
const gtfsToHtml = require('gtfs-to-html');

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

  console.log('boom')

  try {
    await gtfsToHtml(config);
    return {
      ...responseData,
      html_download_url: url.resolve(process.env.SERVER_URL, path.join('downloads', buildId, 'timetables.zip'))
    };
  } catch (error) {
    console.log(error)
    return h.response({
      ...responseData,
      error: error.toString()
    }).code(400);
  }
}
