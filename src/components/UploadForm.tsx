'use client';

import { useState, useCallback } from 'react';
import { useDropzone, type FileRejection } from 'react-dropzone';

import { Loading } from './Loading';
import SuccessMessage from './SuccessMessage';
import { ConfigurationForm } from './ConfigurationForm';
import { type GTFSConfig, defaultGTFSConfig } from '@/types/gtfs-config';

const DEFAULT_CLIENT_ERROR_MESSAGE =
  'Error processing GTFS. For help, email gtfs@blinktag.com with the GTFS you are trying to use.';

const TIMEOUT_ERROR_MESSAGE =
  'Timetable generation exceeded the processing time limit of 13 minutes This GTFS may be too large or complex to process online. Use the GTFS-to-HTML library from the command line, or email gtfs@blinktag.com for help with this dataset.';

// Vercel kills the function itself once `maxDuration` is exceeded, so this
// never reaches our own error handling on the server - the platform returns
// its own 504 response (identified by a `FUNCTION_INVOCATION_TIMEOUT` body)
// instead of the JSON our API routes normally send.
const isFunctionTimeoutResponse = (
  response: Response,
  rawBody: string,
): boolean => {
  return (
    response.status === 504 || /FUNCTION_INVOCATION_TIMEOUT/i.test(rawBody)
  );
};

type ApiErrorResponse = {
  error?: string;
  code?: string;
  category?: string;
};

const isApiErrorResponse = (value: unknown): value is ApiErrorResponse => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.error === 'string';
};

const formatErrorCategory = (category: string): string => {
  return category
    .trim()
    .split(/[_-\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const MAX_STATUS_MESSAGE_LENGTH = 300;

// Ensure multi-line/verbose messages (e.g. stack traces or lists of paths
// leaked from library errors) do not end up rendered in a status message.
const sanitizeStatusMessage = (message: string): string => {
  const firstLine = message.split(/\r?\n/, 1)[0]?.trim() ?? '';
  const cleaned = firstLine.replace(/[:\s]+$/, '');

  if (!cleaned) {
    return DEFAULT_CLIENT_ERROR_MESSAGE;
  }

  if (cleaned.length <= MAX_STATUS_MESSAGE_LENGTH) {
    return cleaned;
  }

  return `${cleaned.slice(0, MAX_STATUS_MESSAGE_LENGTH - 1).trimEnd()}…`;
};

const formatApiErrorMessage = (errorData: ApiErrorResponse): string => {
  const normalizedError = errorData.error
    ? sanitizeStatusMessage(errorData.error)
    : '';
  const normalizedCategory = errorData.category?.trim();
  const normalizedCode = errorData.code?.trim();

  if (!normalizedError && normalizedCode) {
    return `Request failed (${normalizedCode}).`;
  }

  if (!normalizedError) {
    return DEFAULT_CLIENT_ERROR_MESSAGE;
  }

  if (!normalizedCategory) {
    return normalizedError;
  }

  const formattedCategory = formatErrorCategory(normalizedCategory);
  const prefixedCategory = `${formattedCategory} Error:`;
  const hasCategoryPrefix = normalizedError
    .toLowerCase()
    .startsWith(prefixedCategory.toLowerCase());

  return hasCategoryPrefix
    ? normalizedError
    : `${prefixedCategory} ${normalizedError}`;
};

const getUnexpectedErrorMessage = (error: unknown): string => {
  if (error instanceof TypeError) {
    return 'Unable to reach the server. Please check your connection and try again.';
  }

  return DEFAULT_CLIENT_ERROR_MESSAGE;
};

const getResponseError = async (response: Response): Promise<string> => {
  const rawBody = await response.text().catch(() => '');

  if (isFunctionTimeoutResponse(response, rawBody)) {
    return TIMEOUT_ERROR_MESSAGE;
  }

  let data: unknown = null;
  if (rawBody) {
    try {
      data = JSON.parse(rawBody);
    } catch {
      data = null;
    }
  }

  if (isApiErrorResponse(data)) {
    return formatApiErrorMessage(data);
  } else {
    return DEFAULT_CLIENT_ERROR_MESSAGE;
  }
};

const UploadForm = () => {
  const [url, setUrl] = useState('');
  const [config, setConfig] = useState<GTFSConfig>(
    defaultGTFSConfig as GTFSConfig,
  );
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [agencies, setAgencies] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const onDrop = useCallback(
    async (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      setSuccess(false);
      if (rejectedFiles.length > 0) {
        setErrorMessage(
          rejectedFiles
            .flatMap((file) => {
              if (
                file.errors.some((error) => error.code === 'file-too-large')
              ) {
                return [
                  'File is too large. (Maximum file size is 4MB). Try loading via URL instead of file upload, or use GTFS-to-HTML library from the command line.',
                ];
              }

              return file.errors.map((fileError) => fileError.message);
            })
            .join(', '),
        );
        return;
      }

      const file = acceptedFiles[0];
      if (!file) {
        setErrorMessage('No file selected. Please upload a GTFS zip file.');
        return;
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('options', JSON.stringify(config));

      setSuccess(false);
      setErrorMessage('');
      setLoading(true);

      try {
        const response = await fetch('/api/generate/file', {
          method: 'POST',
          body: formData,
        });

        if (response.ok === false) {
          setErrorMessage(await getResponseError(response));
        } else {
          const responseAgencies = getAgenciesFromResponse(response);
          await downloadResponse(response);
          timetableGenerationSuccess(responseAgencies);
        }
      } catch (error) {
        console.error('Error:', error);
        setErrorMessage(getUnexpectedErrorMessage(error));
      } finally {
        setLoading(false);
      }
    },
    [config],
  );
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/x-zip': ['.zip'],
    },
    maxSize: 4 * 1024 * 1024,
    maxFiles: 1,
    disabled: loading,
  });

  const getAgenciesFromResponse = (response: Response): string => {
    const header = response.headers.get('X-Agencies');
    if (!header) {
      return '';
    }

    try {
      return decodeURIComponent(header);
    } catch {
      return '';
    }
  };

  const downloadResponse = async (response: Response) => {
    // Convert response to a Blob
    const blob = await response.blob();

    // Create a temporary URL for the blob
    const url = window.URL.createObjectURL(blob);

    // Create a link element and trigger a download
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'timetables.zip');
    document.body.appendChild(link);
    link.click(); // Trigger the download
    document.body.removeChild(link); // Clean up

    // Revoke the object URL to free up memory
    window.URL.revokeObjectURL(url);
  };

  const timetableGenerationSuccess = (responseAgencies: string) => {
    setAgencies(responseAgencies);
    setSuccess(true);
    setUrl('');
  };

  return (
    <>
      <h2 className="text-center">Try it now with your GTFS</h2>
      <p className="text-center text-gray-600 mb-5">
        Paste the URL of your GTFS or upload it as a zip file to generate a zip
        of timetables you can preview. Large feeds may take several minutes.
      </p>
      <fieldset disabled={loading} className="min-w-0">
        <form
          className="flex flex-row gap-3 items-start"
          onSubmit={async (event) => {
            event.preventDefault();

            if (!url.trim()) {
              setSuccess(false);
              setErrorMessage('Please enter a GTFS URL.');
              return;
            }

            setSuccess(false);
            setErrorMessage('');
            setLoading(true);

            try {
              const response = await fetch('/api/generate/url', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url, options: config }),
              });

              if (response.ok === false) {
                setErrorMessage(await getResponseError(response));
              } else {
                const responseAgencies = getAgenciesFromResponse(response);
                await downloadResponse(response);
                timetableGenerationSuccess(responseAgencies);
              }
            } catch (error) {
              console.error('Error:', error);
              setErrorMessage(getUnexpectedErrorMessage(error));
            } finally {
              setLoading(false);
            }
          }}
        >
          <label className="sr-only" htmlFor="gtfs_url">
            GTFS URL
          </label>
          <input
            type="text"
            id="gtfs_url"
            placeholder="Enter URL of zipped GTFS file"
            className="block w-full"
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
            }}
          />
          <button type="submit" className="block w-[150px] btn">
            Generate
          </button>
        </form>
        <div className="flex items-center gap-4 my-4 text-sm font-medium text-gray-400">
          <div className="h-px flex-1 bg-gray-200"></div>
          OR
          <div className="h-px flex-1 bg-gray-200"></div>
        </div>
        <div
          className="flex items-center justify-center w-full"
          {...getRootProps()}
        >
          <label
            htmlFor="dropzone-file"
            className="flex flex-col items-center justify-center w-full border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <input {...getInputProps()} />
              <svg
                className="w-10 h-10 mb-3 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                ></path>
              </svg>
              <div className="mb-2 text-sm text-gray-500">
                {isDragActive ? (
                  <span className="font-semibold">
                    Drag &apos;n&apos; drop a zipped GTFS file here
                  </span>
                ) : (
                  <span>
                    <span className="font-semibold">Click to upload GTFS</span>{' '}
                    or drag &apos;n&apos; drop
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-500">
                Zipped GTFS only (MAX. 4MB)
              </div>
            </div>
          </label>
        </div>
      </fieldset>
      <div className="mt-4 [overflow-wrap:anywhere]">
        <div role="alert" aria-atomic="true">
          {errorMessage && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-900">
              <p className="font-semibold mb-2">
                Unable to generate timetables
              </p>
              <p>{errorMessage}</p>
            </div>
          )}
        </div>
        <div role="status" aria-atomic="true">
          {loading && (
            <div className="rounded-lg border border-indigo-300 bg-indigo-50 p-4 text-indigo-900">
              <Loading url={url} />
            </div>
          )}
          {success && (
            <SuccessMessage
              agencies={agencies}
              clear={() => setSuccess(false)}
            />
          )}
        </div>
      </div>
      <fieldset disabled={loading} className="min-w-0 mt-6">
        <h3 className="text-lg font-medium text-gray-900 mb-1">
          Configuration Options
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Optional - the default settings work well for a first try. You can
          always regenerate with different settings.
        </p>

        <div className="w-full overflow-hidden">
          <ConfigurationForm
            onConfigChange={setConfig}
            initialConfig={config}
          />
        </div>
      </fieldset>
    </>
  );
};

export default UploadForm;
