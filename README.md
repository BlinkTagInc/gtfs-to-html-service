# GTFS to HTML as a Service

This project is a next.js app that runs on a server and uses [GTFS-to-HTML](https://github.com/BlinkTagInc/gtfs-to-html) to generate HTML or PDF schedules from transit data in GTFS format.

Try it out at https://run.gtfstohtml.com/.

## Setup

### Install dependencies

    npm install

## Running Locally

    npm run dev

### File uploads (Vercel Blob)

Connect a **private** Vercel Blob store to the project and set `BLOB_READ_WRITE_TOKEN` in Development, Preview, and Production. Client upload authorization requires this static token; `BLOB_STORE_ID` and
`BLOB_WEBHOOK_PUBLIC_KEY` alone are not sufficient for this integration. Keep
the token server-side. Add it to `.env.local` for local development.

Set `CRON_SECRET` to a random secret in production. The daily Vercel cron in
`vercel.json` deletes completed uploads older than 24 hours; depending on the
schedule, an abandoned upload can remain for up to about 48 hours. Configure
and monitor this job before enabling public uploads. Local development does
not run Vercel cron automatically.

The browser uploads ZIPs directly to Blob, with a **50 MB (50,000,000 bytes)**
limit enforced both in the form and in the upload token. Uploads remain
anonymous. Server-issued signed tickets authorize upload, generation, and
cleanup for a unique private pathname. Upload tokens expire after 15 minutes;
generation tickets expire after one hour. No filenames or permanent Blob URLs
are exposed publicly.

## Setting up in production

    git clone https://github.com/BlinkTagInc/gtfs-to-html-service.git
    cd gtfs-to-html-service
    npm install
    npm run build

Each Node.js process permits one active generation at a time to limit memory usage. Overlapping requests to that process receive `GENERATION_BUSY` and can be retried (HTTP 503 for direct ZIP requests, an error event for streaming requests whose headers have already been sent). Separate Vercel instances can run jobs independently. Worker isolation does not increase the function's memory limit.

The form requests `Accept: application/x-ndjson` to receive live generation messages, then archive metadata, base64 ZIP chunks, and a completion event on the same response. This avoids storing download state across function instances. Clients without that Accept header continue to receive a direct ZIP response. Public GTFS errors retain their messages and codes; unexpected infrastructure failures receive a generic message. Raw worker stderr and full exception objects remain server-side. The form retains the latest 200 messages and downloads only after receiving the completion event and checking the ZIP size. Interrupted streams do not produce a partial download.

## Contributing

Pull requests are welcome, as is feedback and [reporting issues](https://github.com/blinktaginc/gtfs-to-html-service/issues).
