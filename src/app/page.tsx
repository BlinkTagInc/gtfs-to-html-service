import Image from 'next/image';

import UploadForm from '../components/UploadForm';

export default function Home() {
  return (
    <>
      <main className="flex min-h-screen flex-col md:items-center justify-between px-3 py-4 md:pt-20">
        <div className="flex flex-row justify-center">
          <Image
            className="relative"
            src="/gtfs-to-html-logo.svg"
            alt="GTFS-to-HTML Logo"
            width={180}
            height={180}
            priority
          />
        </div>
        <div className="max-w-[650px] mx-auto mt-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-balance mb-3">
            Turn your GTFS into timetables for your website
          </h1>
          <p className="text-lg leading-8 text-gray-600 text-balance">
            GTFS-to-HTML converts your transit agency&apos;s GTFS into
            ready-to-publish HTML timetables and route maps. Free and open
            source - no signup required.
          </p>
        </div>
        <div className="card my-6 max-w-[650px]">
          <UploadForm />
        </div>
        <div className="card max-w-[650px] mx-auto my-6">
          <h2 className="mb-5">Why use GTFS-to-HTML?</h2>

          <div className="flex flex-row gap-5 mb-6">
            <div className="shrink-0 text-4xl mt-1">📱</div>
            <div className="leading-7">
              Your agency already publishes GTFS so that trip planning apps like
              Google Maps and Transit can use your schedules. But riders also
              expect timetables and route maps on your agency&apos;s own website
              - and building those by hand is slow and error-prone.
            </div>
          </div>

          <div className="flex flex-row gap-5 mb-6">
            <div className="shrink-0 text-4xl mt-1">📄</div>
            <div className="leading-7">
              GTFS-to-HTML turns that same GTFS data into attractively
              formatted, mobile-friendly timetables and maps in HTML, PDF or CSV
              format, ready to add to your website.
            </div>
          </div>

          <div className="flex flex-row gap-5 mb-6">
            <div className="shrink-0 text-4xl mt-1">🔄</div>
            <div className="leading-7">
              When schedules change, regenerate your timetables instead of
              rebuilding them by hand. Timetables stay accurate and up to date,
              and the likelihood of errors is reduced.
            </div>
          </div>

          <div className="flex flex-row gap-5 mb-6">
            <div className="shrink-0 text-4xl mt-1">🚍</div>
            <div className="leading-7">
              GTFS-Realtime is supported out of the box. Display realtime
              vehicle locations on route maps, arrival predictions and service
              alerts.
            </div>
          </div>

          <div className="flex flex-row gap-5 mb-8">
            <div className="shrink-0 text-4xl mt-1">🆓</div>
            <div className="leading-7">
              GTFS-to-HTML is{' '}
              <a href="https://github.com/BlinkTagInc/gtfs-to-html">
                free and open source
              </a>
              . Use it however you want - there is nothing to license and no
              fees.
            </div>
          </div>

          <div className="flex flex-row justify-center">
            <a href="https://gtfstohtml.com/docs" className="btn">
              Read the GTFS-to-HTML Documentation
            </a>
          </div>
        </div>

        <div className="card max-w-[650px] mx-auto my-6 border-[#3230AD]/30 bg-indigo-50">
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-3">
            <Image
              src="/blinktag-logo.svg"
              alt="BlinkTag Inc Logo"
              width={132}
              height={36}
              className="shrink-0"
            />
            <h2 className="mb-0 text-center sm:text-left">
              Implementation Help &amp; Support
            </h2>
          </div>

          <p className="text-gray-600">
            Getting timetables live on your agency&apos;s website usually takes
            some configuration, a custom template to match your brand and
            integration of the HTML, CSS and JS output. If you&apos;d like a
            hand, <a href="https://blinktag.com">BlinkTag Inc</a> (the team
            behind GTFS-to-HTML) is available for consulting:
          </p>

          <ul className="text-gray-600 leading-7 space-y-1 mb-5">
            <li>Configuration help and troubleshooting</li>
            <li>
              Custom timetable templates matching your agency&apos;s brand
            </li>
            <li>Implementation and website integration</li>
            <li>Solving issues with your GTFS data</li>
            <li>Developing new features</li>
          </ul>

          <div className="flex flex-row justify-center mb-4">
            <a
              href="mailto:gtfs@blinktag.com?subject=GTFS-to-HTML%20implementation%20help"
              className="btn"
            >
              Get Implementation Help
            </a>
          </div>

          <p className="text-gray-600 mb-0">
            Have questions or feedback? Email us at{' '}
            <a href="mailto:gtfs@blinktag.com">gtfs@blinktag.com</a>. Let us
            know if your transit agency is using GTFS-to-HTML and we&apos;ll add
            you to the list of{' '}
            <a href="https://gtfstohtml.com/docs/current-usage">
              agencies using GTFS-to-HTML
            </a>
            .
          </p>
        </div>
      </main>

      <div className="footer">
        Created by <a href="https://blinktag.com">BlinkTag Inc</a>
        <br />
        Powered by <a href="https://gtfstohtml.com">GTFS-to-HTML</a>
        <br />
        <a href="https://gtfstohtml.com/docs/related-libraries">
          Other GTFS Tools
        </a>
        <br />
        Contribute on{' '}
        <a href="https://github.com/BlinkTagInc/gtfs-to-html-service">Github</a>
        <br />
        <a href="mailto:gtfs@blinktag.com">Contact Us</a>
      </div>
    </>
  );
}
