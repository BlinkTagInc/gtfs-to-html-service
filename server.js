require('dotenv').config();
const next = require('next');
const Hapi = require('@hapi/hapi');
const mongoose = require('mongoose');
const {nextHandlerWrapper} = require('./next-wrapper');

const dev = process.env.NODE_ENV !== 'production';
const port = process.env.PORT || 3000;
const createTimetablesApi = require('./api/create');

const app = next({dev});
const server = new Hapi.Server({
  port
});
const io = require('socket.io')(server.listener);

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useCreateIndex: true });

// socket.io server
io.on('connection', socket => {
  console.log('connection')
  socket.on('create', data => {
    if (!data.url) {
      return socket.emit('status', { error: 'No URL provided' });
    } else if (!data.buildId) {
      return socket.emit('status', { error: 'No Build ID provided' });
    }

    createTimetablesApi(data, socket);
  });
});

app.prepare()
.then(async () => {
  server.route({
    method: 'GET',
    path: '/{p*}', /* Catch all route */
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
