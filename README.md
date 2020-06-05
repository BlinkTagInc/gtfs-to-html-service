# GTFS to HTML as a Service

[![XO code style](https://img.shields.io/badge/code_style-XO-5ed9c7.svg)](https://github.com/sindresorhus/xo)

This is the codebase for https://gtfstohtml.com/

This project is a node.js app that runs on a server and uses the [gtfs-to-html](https://github.com/brendannee/gtfs-to-html) to generate HTML schedules from transit data in GTFS format. It listens via websockets for the agency name, GTFS file location and timetable configuration and responds with a URL where the completed HTML timetabled can be downloaded.

## Setup

### Install dependencies

    npm install

## Configure

Copy `.env-example` to `.env`.

    cp .env-example .env

Update the values as needed.

## Running Locally

    npm run dev

Connect to a websocket on `localhost:3000`. Use something like the  [Simple Websocket Client](https://chrome.google.com/webstore/detail/simple-websocket-client/pfdhoblngboilpfeibdedpjgfnlcodoo) Chrome extension.

Send a websocket message with a JSON payload to `localhost:3000`. This JSON can include any options from [gtfs-to-html](https://github.com/brendannee/gtfs-to-html) except `verbose`, `zipOutput`, and `mongoUrl`.

    {
      "agencies": [
        {
          "agency_key": "bart",
          "url": "https://transitfeeds.com/p/bart/58/latest/download"
        }
      ],
      "effectiveDate": "July 8, 2016",
      "noServiceSymbol": "—",
      "requestStopSymbol": "***",
      "showMap": true
    }

The server will respond via websockets. If the timetable generation is successful, the response will include a URL where the timetables can be downloaded.

    {
      "buildId":"132da383-721f-4ba3-9ab0-c979ac9e17f4",
      "status": "completed",
      "message": "Completed creating timetables for bart",
      "url": "http://localhost:3000/bart/gtfs.zip"
    }

If instead there is an error while processing, the response will contain the error.

    {
      "buildId":"132da383-721f-4ba3-9ab0-c979ac9e17f4",
      "status": "error",
      "message": "Error: Number of columns on line 69 does not match header"
    }

## Running in production

pm2 start server
pm2 stop server

### Tests

    npm test
