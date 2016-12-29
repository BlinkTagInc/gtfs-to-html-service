require('dotenv').config();

const path = require('path');
const server = require('http').createServer();
const url = require('url');

const WebSocketServer = require('ws').Server;
const express = require('express');
const sanitize = require('sanitize-filename');
const mongoose = require('mongoose');
const uuidV4 = require('uuid/v4');

const gtfsToHtml = require('gtfs-to-html');

mongoose.Promise = global.Promise;
mongoose.connect(process.env.MONGO_URL);

const app = express();
const wss = new WebSocketServer({server});

app.use(express.static('html'));

function formatStatus(status, message, buildId, extra) {
  console.log(`${buildId}: ${status}: ${message}`);

  const json = extra || {};
  json.buildId = buildId;
  json.status = status;
  json.message = message;

  return JSON.stringify(json);
}

wss.on('connection', ws => {
  ws.send('connected');

  ws.on('message', message => {
    let config;
    const buildId = uuidV4();

    try {
      config = JSON.parse(message);
    } catch (err) {
      return ws.send(formatStatus('error', 'Invalid JSON sent', buildId));
    }

    if (!config.agencies || !config.agencies.length) {
      return ws.send(formatStatus('error', 'No `agencies` sent', buildId));
    }

    if (config.agencies.length > 1) {
      return ws.send(formatStatus('error', 'Only one agency may be spcified in the `agencies` array', buildId));
    }

    if (!config.agencies[0].agency_key) {
      return ws.send(formatStatus('error', 'No `agency_key` sent', buildId));
    }

    const agencyKey = config.agencies[0].agency_key;

    ws.send(formatStatus('processing', `Processing ${agencyKey}`, buildId));

    config.verbose = true;
    config.zipOutput = true;
    config.mongoUrl = process.env.MONGO_URL;

    gtfsToHtml(config, err => {
      if (err) {
        return ws.send(formatStatus('error', err.toString(), buildId));
      }
      const message = `Completed creating timetables for ${agencyKey}`;
      const extra = {
        url: url.resolve(process.env.SERVER_URL, path.join(sanitize(agencyKey), 'timetables.zip'))
      };
      ws.send(formatStatus('completed', message, buildId, extra));
    });
  });
});

server.on('request', app);
server.listen(process.env.PORT || 3000, () => {
  console.log(`Listening on ${server.address().port}`);
});
