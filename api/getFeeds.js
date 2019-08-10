const fetch = require('node-fetch');

module.exports = request => {
  const location = request.query.location;
  const limit = request.query.limit;
  return fetch(`https://api.transitfeeds.com/v1/getFeeds?key=${process.env.TRANSIT_FEEDS_API_KEY}&location=${location}&limit=${limit}`)
    .then(res => res.json());
}
