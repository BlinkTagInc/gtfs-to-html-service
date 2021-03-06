import Hapi from '@hapi/hapi';
import next from 'next';
import * as io from 'socket.io';

import {nextHandlerWrapper} from './next-wrapper.js';
import createTimetables from './util/create.mjs';
import getLocations from './api/getLocations.mjs';
import getFeeds from './api/getFeeds.mjs';
import getFeedVersions from './api/getFeedVersions.mjs';

const port = Number.parseInt(process.env.PORT, 10) || 3000;
const dev = process.env.NODE_ENV !== 'production';
const app = next({dev});
const server = new Hapi.Server({
  port
});

const socketIo = new io.Server(server.listener);

// Socket.io server
socketIo.on('connection', socket => {
  socket.on('create', data => {
    if (!data.url) {
      return socket.emit('status', {
        error: 'No URL provided'
      });
    }

    if (!data.buildId) {
      return socket.emit('status', {
        error: 'No Build ID provided'
      });
    }

    createTimetables(data, socket);
  });
});

app.prepare().then(async () => {
  server.route({
    method: 'GET',
    path: '/api/locations',
    handler: getLocations
  });

  server.route({
    method: 'GET',
    path: '/api/feeds',
    handler: getFeeds
  });

  server.route({
    method: 'GET',
    path: '/api/feed-versions',
    handler: getFeedVersions
  });

  server.route({
    method: 'GET',
    path: '/_next/{p*}' /* next specific routes */,
    handler: nextHandlerWrapper(app)
  });

  server.route({
    method: '*',
    path: '/{p*}' /* catch all route */,
    handler: nextHandlerWrapper(app)
  });

  try {
    await server.start();
    console.log(`> Ready on http://localhost:${port}`);
  } catch (error) {
    console.log('Error starting server');
    console.log(error);
  }
});
