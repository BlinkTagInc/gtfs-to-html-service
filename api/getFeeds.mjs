import fetch from 'node-fetch';

export default request => {
  const {location} = request.query;
  const {limit} = request.query;
  return fetch(`https://api.transitfeeds.com/v1/getFeeds?key=${process.env.TRANSIT_FEEDS_API_KEY}&location=${location}&limit=${limit}`)
    .then(res => res.json());
};
