const fetch = require('node-fetch');

module.exports = () => {
  return fetch(`https://api.transitfeeds.com/v1/getLocations?key=${process.env.TRANSIT_FEEDS_API_KEY}`)
    .then(res => res.json());
}
