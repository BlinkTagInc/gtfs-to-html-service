'use client';

import { useState, useCallback } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import { useDropzone, FileRejection, FileWithPath } from 'react-dropzone';
import 'react-toastify/dist/ReactToastify.css';

import { Loading } from './Loading';
import SuccessMessage from './SuccessMessage';

const UploadForm = () => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const onDrop = useCallback(
    async (acceptedFiles: FileWithPath[], rejectedFiles: FileRejection[]) => {
      if (rejectedFiles.length > 0) {
        toast(
          rejectedFiles
            .flatMap((file) =>
              file.errors.map((fileError) => fileError.message),
            )
            .join(', '),
          { type: 'error' },
        );
        return;
      }

      const file = acceptedFiles[0];
      const formData = new FormData();
      formData.append('file', file);

      setLoading(true);

      try {
        const response = await fetch('/api/generate/file', {
          method: 'POST',
          body: formData,
        });

        if (response.ok === false) {
          const data = await response.json();
          toast(data.error ?? 'Error processing GTFS', {
            type: 'error',
          });
        } else {
          await downloadResponse(response);
          timetableGenerationSuccess();
        }

        setLoading(false);
      } catch (error) {
        console.error('Error:', error);
        toast('Error processing GTFS', { type: 'error' });
        setLoading(false);
      }
    },
    [],
  );
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/x-zip': ['.zip'],
    },
    maxSize: 20 * 1024 * 1024,
    maxFiles: 1,
  });

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

  const timetableGenerationSuccess = () => {
    setSuccess(true);
    setUrl('');
  };

  return (
    <>
      <h2 className="text-center">Generate HTML timetables from GTFS</h2>
      {success ? (
        <SuccessMessage clear={() => setSuccess(false)} />
      ) : loading ? (
        <Loading url={url} />
      ) : (
        <>
          <form
            className="flex flex-row gap-3 items-start"
            onSubmit={async (event) => {
              event.preventDefault();

              if (!url) {
                toast('Please enter a URL', { type: 'error' });
                return;
              }

              setLoading(true);

              try {
                const response = await fetch('/api/generate/url', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ url }),
                });

                if (response.ok === false) {
                  const data = await response.json();
                  toast(data.error ?? 'Error processing GTFS', {
                    type: 'error',
                  });
                } else {
                  await downloadResponse(response);
                  timetableGenerationSuccess();
                }

                setLoading(false);
              } catch (error) {
                console.error('Error:', error);
                toast('Error processing GTFS', { type: 'error' });
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
            <button type="submit" className="block w-[150px]">
              Generate
            </button>
          </form>
          <div className="text-center text-2xl my-3">OR</div>
          <div
            className="flex items-center justify-center w-full"
            {...getRootProps()}
          >
            <label
              htmlFor="dropzone-file"
              className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100"
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
                <p className="mb-2 text-sm text-gray-500">
                  {isDragActive ? (
                    <span className="font-semibold">
                      Drag &apos;n&apos; drop a zipped GTFS file here
                    </span>
                  ) : (
                    <span>
                      <span className="font-semibold">
                        Click to upload GTFS
                      </span>{' '}
                      or drag &apos;n&apos; drop
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-500">
                  Zipped GTFS only (MAX. 20MB)
                </p>
              </div>
            </label>
          </div>
        </>
      )}
      <ToastContainer />
    </>
  );
};

export default UploadForm;