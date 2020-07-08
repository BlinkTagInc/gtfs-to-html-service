require('dotenv').config();
const next = require('next');
const Hapi = require('@hapi/hapi');
const mongoose = require('mongoose');
const {
  nextHandlerWrapper
} = require('./next-wrapper');

const dev = process.env.NODE_ENV !== 'production';
const port = process.env.PORT || 3000;
const createTimetables = require('./util/create');
const getLocations = require('./api/getLocations');
const getFeeds = require('./api/getFeeds');
const getFeedVersions = require('./api/getFeedVersions');

const app = next({
  dev
});
const server = new Hapi.Server({
  port
});
const io = require('socket.io')(server.listener);

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useCreateIndex: true,
  useUnifiedTopology: true
});

// socket.io server
io.on('connection', socket => {
  socket.on('create', data => {
    if (!data.url) {
      return socket.emit('status', {
        error: 'No URL provided'
      });
    } else if (!data.buildId) {
      return socket.emit('status', {
        error: 'No Build ID provided'
      });
    }

    createTimetables(data, socket);
  });
});

app.prepare()
  .then(async () => {
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
      path: '/{p*}',
      /* Catch all route */
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
