const Hapi = require('@hapi/hapi');
const mongoose = require('mongoose');

const port = process.env.PORT || 3000;

const init = async () => {

  const server = Hapi.server({
    port
  });

  mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useCreateIndex: true
  });

  const createTimetablesApi = require('./api/create');

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

  await server.start();
  console.log('Server running on %s', server.info.uri);
};

process.on('unhandledRejection', (err) => {
  console.log(err);
  process.exit(1);
});

init();
