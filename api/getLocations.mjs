import fetch from 'node-fetch';

export default () => {
  return fetch(`https://api.transitfeeds.com/v1/getLocations?key=${process.env.TRANSIT_FEEDS_API_KEY}`)
    .then(res => res.json());
};
