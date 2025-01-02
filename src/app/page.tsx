import Image from 'next/image';

import UploadForm from '../components/UploadForm';

export default function Home() {
  return (
    <>
      <main className="flex min-h-screen flex-col items-center justify-between px-3 py-4 md:pt-20">
        <div className="">
          <Image
            className="relative"
            src="/gtfs-to-html-logo.svg"
            alt="GTFS-to-HTML Logo"
            width={180}
            height={180}
            priority
          />
        </div>
        <div className="card my-6 max-w-[650px]">
          <UploadForm />
        </div>
        <div className="card max-w-[475px] mx-auto my-6">
          <h2 className="text-xl font-bold mb-3">What is this tool?</h2>

          <div className="flex flex-row gap-10 mb-8">
            <div className="flex-shrink-0 text-6xl mt-2">🚆</div>
            <div>
              GTFS-to-HTML creates human-readable, user-friendly transit
              timetables in HTML format directly from GTFS transit data.
            </div>
          </div>

          <div className="flex flex-row gap-10 mb-8">
            <div className="flex-shrink-0 text-6xl mt-2">🕑</div>
            <div>
              Most transit agencies have schedule data in GTFS format but need
              to public route timetables and maps on their website.
            </div>
          </div>

          <div className="flex flex-row gap-10 mb-8">
            <div className="flex-shrink-0 text-6xl mt-2">📱</div>
            <div>
              GTFS allows transit data to be published to apps like Google Maps
              and the Transit app. HTML is a human-readable format (like this
              website).
            </div>
          </div>

          <div className="flex flex-row gap-10 mb-8">
            <div className="flex-shrink-0 text-6xl mt-2">🧰</div>
            <div>
              This tool automates the process of creating attractively formatted
              HTML or PDF timetables for inclusion on a transit agency website.
            </div>
          </div>

          <div className="flex flex-row gap-10 mb-8">
            <div className="flex-shrink-0 text-6xl mt-2">✅</div>
            <div>
              Automating timetable creation means that timetables can be kept up
              to date and accurate when schedule changes happen and the
              likelihood of errors is reduced.
            </div>
          </div>

          <div className="flex flex-row gap-10 mb-8">
            <div className="flex-shrink-0 text-6xl mt-2">🚍</div>
            <div>
              GTFS-Realtime is supported. Display realtime vehicle locations on
              route maps, arrival predictions and service alerts.
            </div>
          </div>

          <div className="flex flex-row justify-center">
            <a href="https://gtfstohtml.com/docs" className="btn">
              Read More about GTFS-to-HTML
            </a>
          </div>
        </div>

        <div className="card max-w-[475px] mx-auto my-6">
          <h2 className="text-xl font-bold mb-3">
            Questions, Feedback and Support
          </h2>

          <div className="flex flex-row gap-10 mb-8">
            <div className="flex-shrink-0 text-6xl">✉️</div>
            <div>
              Have questions about GTFS-to-HTML or need help integrating it into
              your agency&apos;s website? Email us at{' '}
              <a href="mailto:gtfs@blinktag.com">gtfs@blinktag.com</a>.
              <br />
              <br />
              Let us know if your transit agency is using GTFS-to-HTML and
              we&apos;ll add you to the list of{' '}
              <a href="https://gtfstohtml.com/docs/current-usage">
                agencies using GTFS-to-HTML
              </a>
              .
            </div>
          </div>
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
