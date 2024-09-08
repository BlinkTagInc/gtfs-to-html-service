import Image from 'next/image';

import UploadForm from '../components/UploadForm';

export default function Home() {
  return (
    <>
      <main className="flex min-h-screen flex-col items-center justify-between px-3 py-4 md:p-20">
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
        <div>
          <div className="card max-w-[650px] mx-auto my-6">
            <h2 className="text-xl font-bold">What is GTFS-to-HTML?</h2>
            <p>
              A tool that creates human-readable, user-friendly transit
              timetables in HTML, PDF or CSV format directly from{' '}
              <a href="https://gtfs.org">GTFS transit data</a>.
            </p>

            <h2 className="text-xl font-bold">Why?</h2>
            <p>
              Most transit agencies have schedule data in GTFS format but need
              to route schedules and maps their website. GTFS-to-HTML automates
              the process of creating nicely formatted HTML timetables and maps
              which are fully accessible, mobile-friendly and interactive. This
              makes it easy to keep timetables up to date and accurate whenever
              schedule changes happen and reduces the likelihood of errors.
            </p>
            <a href="https://gtfstohtml.com/docs" className="btn">
              Read More about GTFS-to-HTML
            </a>
          </div>
        </div>
      </main>

      <div className="footer">
        Created by <a href="https://blinktag.com">BlinkTag Inc</a>
        <br />
        Powered by{' '}
        <a href="https://github.com/BlinkTagInc/gtfs-to-html">GTFS-to-HTML</a>
        <br />
        <a href="https://gtfstohtml.com/docs/related-libraries">
          Other GTFS Tools
        </a>
        <br />
        Contribute on{' '}
        <a href="https://github.com/BlinkTagInc/gtfs-to-html-service">Github</a>
      </div>
    </>
  );
}
