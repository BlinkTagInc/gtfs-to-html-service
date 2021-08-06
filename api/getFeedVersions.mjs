import fetch from 'node-fetch';

export default request => {
  const {feed} = request.query;
  return fetch(`https://api.transitfeeds.com/v1/getFeedVersions?key=${process.env.TRANSIT_FEEDS_API_KEY}&feed=${feed}`)
    .then(res => res.json());
};
