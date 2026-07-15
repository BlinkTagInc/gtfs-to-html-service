import Image from 'next/image';

const CONSULTING_EMAIL = 'gtfs@blinktag.com';

const SuccessMessage = ({
  clear,
  agencies,
}: {
  clear: () => void;
  agencies?: string;
}) => {
  const agencyNames = agencies?.trim() || '';

  const helpMailto = `mailto:${CONSULTING_EMAIL}?${new URLSearchParams({
    subject: `GTFS-to-HTML implementation help${agencyNames ? ` for ${agencyNames}` : ''}`,
    body: `Hi BlinkTag,\n\nWe generated HTML timetables${agencyNames ? ` for ${agencyNames}` : ''} using gtfstohtml.com and would like help implementing them on our website.\n\n`,
  })
    .toString()
    .replaceAll('+', '%20')}`;

  const listMailto = `mailto:${CONSULTING_EMAIL}?${new URLSearchParams({
    subject: `Add ${agencyNames || 'our agency'} to the list of agencies using GTFS-to-HTML`,
    body: `Hi BlinkTag,\n\n${agencyNames ? `${agencyNames} is` : 'We are'} using GTFS-to-HTML. Please add us to the list of agencies using GTFS-to-HTML. Here is a link to our timetables:\n\n`,
  })
    .toString()
    .replaceAll('+', '%20')}`;

  return (
    <div className=" h-full p-6">
      <div className="mt-6 w-full rounded-lg border border-[#008000]/30 bg-green-50 p-5 flex flex-col items-center justify-center">
        <div className="flex items-center justify-center w-16 h-16 bg-green-200 rounded-full">
          <svg
            className="w-12 h-12 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M5 13l4 4L19 7"
            ></path>
          </svg>
        </div>
        <h1 className="mt-4 text-2xl font-bold text-green-700">
          Your timetables are ready!
        </h1>
        <p className="mt-2 text-gray-600 text-center">
          HTML timetables{agencyNames ? ` for ${agencyNames}` : ''} were
          generated and downloaded as <code>timetables.zip</code>.
        </p>
        <p className="mt-1 text-sm text-gray-600 text-center">
          To preview them, unzip it and open <code>index.html</code> in your
          browser.
        </p>
      </div>

      <div className="mt-6 w-full rounded-lg border border-[#3230AD]/30 bg-indigo-50 p-5">
        <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-3">
          <Image
            src="/blinktag-logo.svg"
            alt="BlinkTag Inc Logo"
            width={132}
            height={36}
            className="shrink-0"
          />
          <h2 className="text-lg font-bold mb-0 text-balance text-center sm:text-left">
            Need help getting these timetables on your website?
          </h2>
        </div>
        <p className="text-base text-gray-700 leading-6 mb-3">
          The typical next steps are adjusting the configuration, customizing
          the template to match your agency&apos;s brand and integrating the
          HTML, CSS and JS into your website. You can do it all yourself - or if
          you&apos;d like a hand,{' '}
          <a href="https://blinktag.com">BlinkTag Inc</a>, the team behind
          GTFS-to-HTML, offers consulting for implementation, troubleshooting
          and custom feature development.
        </p>
        <div className="flex flex-row flex-wrap items-center gap-3">
          <a href={helpMailto} className="btn inline-block">
            Get Implementation Help
          </a>
          <span className="text-sm text-gray-600">
            or email{' '}
            <a href={`mailto:${CONSULTING_EMAIL}`}>{CONSULTING_EMAIL}</a>
          </span>
        </div>
      </div>

      <p className="mt-5 text-sm text-gray-600 text-center leading-6 mb-0">
        Is {agencyNames ? <strong>{agencyNames}</strong> : 'your agency'} using
        GTFS-to-HTML? <a href={listMailto}>Let us know</a> and we&apos;ll add
        you to the list of{' '}
        <a href="https://gtfstohtml.com/docs/current-usage">
          agencies using GTFS-to-HTML
        </a>
        .
      </p>

      <div className="flex flex-row justify-center">
        <button className="mt-5 btn cursor-pointer" onClick={() => clear()}>
          &larr; Generate More Timetables
        </button>
      </div>
    </div>
  );
};

export default SuccessMessage;
