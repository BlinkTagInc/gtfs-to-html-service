'use client';

import { useRef, useState } from 'react';
import { archiveFilename } from '@/lib/archive-filename';
import type { TimetablePreview } from '@/lib/preview-policy';
import Image from 'next/image';

const CONSULTING_EMAIL = 'gtfs@blinktag.com';

const SuccessMessage = ({
  clear,
  agencies,
  preview,
}: {
  clear: () => void;
  agencies?: string;
  preview?: TimetablePreview;
}) => {
  const agencyNames = agencies?.trim() || '';
  const shareUrlInput = useRef<HTMLInputElement>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>(
    'idle',
  );

  const copyShareUrl = async () => {
    if (!preview) {
      return;
    }
    try {
      await navigator.clipboard.writeText(
        new URL(preview.url, window.location.origin).href,
      );
      setCopyStatus('copied');
    } catch {
      shareUrlInput.current?.focus();
      shareUrlInput.current?.select();
      setCopyStatus('error');
    }
  };

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
    <div className="h-full">
      <div className="w-full rounded-lg border border-[#008000]/30 bg-green-50 p-5 flex flex-col items-center justify-center">
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
          HTML timetables
          {agencyNames ? ` for ${agencyNames}` : ''} were generated and
          downloaded as <code>{archiveFilename(agencyNames)}</code>. Unzip and
          open <code>index.html</code> in your browser.
        </p>
        {preview ? (
          <div className="text-center w-full break-words">
            <div className="flex flex-row gap-2">
              <a
                href={preview.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn inline-block my-4"
              >
                View timetables
              </a>
              <a
                className="btn inline-block my-4"
                href={
                  preview.downloadUrl ??
                  preview.url.replace(/index\.html$/, 'timetables.zip')
                }
              >
                Download ZIP again
              </a>
            </div>
            <div className="mt-3 text-sm text-gray-600">
              A sharable preview of your timetables was published to:
            </div>
            <div className="my-1 flex items-center gap-2">
              <input
                ref={shareUrlInput}
                aria-label="Shareable preview URL"
                readOnly
                value={
                  typeof window === 'undefined'
                    ? preview.url
                    : new URL(preview.url, window.location.origin).href
                }
                onFocus={(event) => event.target.select()}
                className="min-w-0 flex-1 text-sm bg-white"
              />
              <button
                type="button"
                onClick={copyShareUrl}
                aria-label="Copy shareable preview URL"
                className="btn inline-flex shrink-0 items-center gap-2 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <svg
                  aria-hidden="true"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <rect x="9" y="9" width="11" height="11" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Copy
              </button>
            </div>
            <p role="status" className="text-xs text-gray-700">
              {copyStatus === 'copied'
                ? 'Link copied!'
                : copyStatus === 'error'
                  ? 'Unable to copy automatically. Copy the selected link manually.'
                  : ''}
            </p>
            <div className="text-xs">
              Anyone with this link can view the timetables until{' '}
              {new Date(preview.expiresAt).toLocaleString()}.
            </div>
          </div>
        ) : (
          <p className="text-center w-full break-words">
            An online preview is unavailable.
          </p>
        )}
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
          <h2 className="text-xl font-bold mb-0 text-balance text-center sm:text-left">
            Need help getting these timetables on your website?
          </h2>
        </div>
        <p className="text-gray-700 mb-4">
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
