# GTFS to HTML as a Service

This project is a next.js app that runs on a server and uses [GTFS-to-HTML](https://github.com/BlinkTagInc/gtfs-to-html) to generate HTML or PDF schedules from transit data in GTFS format.

Try it out at https://run.gtfstohtml.com/.

## Setup

### Install dependencies

    npm install

## Running Locally

    npm run dev

## Setting up in production

    git clone https://github.com/BlinkTagInc/gtfs-to-html-service.git
    cd gtfs-to-html-service
    npm install
    npm run build

Each Node.js process permits one active generation at a time to limit memory usage. Overlapping requests to that process receive `GENERATION_BUSY` and can be retried (HTTP 503 for direct ZIP requests, an error event for streaming requests whose headers have already been sent). Separate Vercel instances can run jobs independently. Worker isolation does not increase the function's memory limit.

The form requests `Accept: application/x-ndjson` to receive live generation messages, then archive metadata, base64 ZIP chunks, and a completion event on the same response. This avoids storing download state across function instances. Clients without that Accept header continue to receive a direct ZIP response. Public GTFS errors retain their messages and codes; unexpected infrastructure failures receive a generic message. Raw worker stderr and full exception objects remain server-side. The form retains the latest 200 messages and downloads only after receiving the completion event and checking the ZIP size. Interrupted streams do not produce a partial download.

## Contributing

Pull requests are welcome, as is feedback and [reporting issues](https://github.com/blinktaginc/gtfs-to-html-service/issues).
