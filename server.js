const next = require('next');
const Hapi = require('@hapi/hapi');
const HapiRequireHttps = require('hapi-require-https');
const mongoose = require('mongoose');
const {nextHandlerWrapper} = require('./next-wrapper');

const dev = process.env.NODE_ENV !== 'production';
const port = process.env.PORT || 3000;
require('dotenv').config();

const app = next({dev});
const server = new Hapi.Server({
  port
});

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true });

const createTimetablesApi = require('./api/create');

app.prepare()
.then(async () => {
  if (process.env.NODE_ENV === 'production') {
    await server.register({
      plugin: HapiRequireHttps,
      options: {}
    });
  }

  server.route({
    method: 'POST',
    path: '/api/create',
    handler: createTimetablesApi
  });

  await server.register(require('@hapi/inert'));

  server.route({
    method: 'GET',
    path: '/results/{param*}',
    handler: {
      directory: {
        path: 'html'
      }
    }
  });

  server.route({
    method: 'GET',
    path: '/{p*}', /* Catch all route */
    handler: nextHandlerWrapper(app)
  })

  try {
    await server.start();
    console.log(`> Ready on http://localhost:${port}`);
  } catch (error) {
    console.log('Error starting server');
    console.log(error);
  }
});
