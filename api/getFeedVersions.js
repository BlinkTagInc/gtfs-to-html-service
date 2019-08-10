const fetch = require('node-fetch');

module.exports = request => {
  const feed = request.query.feed;
  return fetch(`https://api.transitfeeds.com/v1/getFeedVersions?key=${process.env.TRANSIT_FEEDS_API_KEY}&feed=${feed}`)
    .then(res => res.json());
}
