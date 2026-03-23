import { isGtfsToHtmlError, isGtfsError } from 'gtfs-to-html';

const DEFAULT_SERVER_ERROR_MESSAGE =
  'An unexpected server error occurred. For help, email gtfs@blinktag.com with the GTFS you are trying to use.';
const DEFAULT_DOWNLOAD_ERROR_MESSAGE =
  'Unable to download GTFS from the provided URL. Please verify the URL and try again.';

const DOWNLOAD_NETWORK_ERROR_TOKENS = [
  'ENOTFOUND',
  'EAI_AGAIN',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'getaddrinfo',
];

export type PublicErrorResponse = {
  error: string;
  code: string;
  category: string;
  statusCode: number;
};

const getDownloadErrorFromMessage = (
  message: string,
): PublicErrorResponse | null => {
  const statusMatch = message.match(/Got status (\d+)/);

  if (statusMatch) {
    const httpStatus = Number.parseInt(statusMatch[1], 10);

    if (httpStatus === 404) {
      return {
        error:
          'GTFS file not found at the provided URL. Please verify the URL is correct and the file exists.',
        code: 'DOWNLOAD_NOT_FOUND',
        category: 'download',
        statusCode: 400,
      };
    }

    if (httpStatus === 403) {
      return {
        error:
          'Access denied to the GTFS file. The URL may require authentication or have restricted access.',
        code: 'DOWNLOAD_FORBIDDEN',
        category: 'download',
        statusCode: 400,
      };
    }

    if (httpStatus >= 500) {
      return {
        error:
          'Server error when downloading GTFS file. The source server may be temporarily unavailable.',
        code: 'DOWNLOAD_UPSTREAM',
        category: 'download',
        statusCode: 502,
      };
    }

    if (httpStatus >= 400) {
      return {
        error: `Unable to download GTFS file. Server returned status ${httpStatus}.`,
        code: 'DOWNLOAD_BAD_RESPONSE',
        category: 'download',
        statusCode: 400,
      };
    }
  }

  const hasNetworkDownloadToken = DOWNLOAD_NETWORK_ERROR_TOKENS.some((token) =>
    message.includes(token),
  );
  if (hasNetworkDownloadToken) {
    return {
      error:
        'Unable to reach the source URL. Please check the URL and try again.',
      code: 'DOWNLOAD_NETWORK',
      category: 'download',
      statusCode: 400,
    };
  }

  if (message.includes('Unable to download GTFS')) {
    return {
      error: DEFAULT_DOWNLOAD_ERROR_MESSAGE,
      code: 'DOWNLOAD',
      category: 'download',
      statusCode: 400,
    };
  }

  return null;
};

const getServerErrorResponse = (): PublicErrorResponse => {
  return {
    error: DEFAULT_SERVER_ERROR_MESSAGE,
    code: 'SERVER_ERROR',
    category: 'server',
    statusCode: 500,
  };
};

export const getPublicGtfsErrorResponse = (
  error: unknown,
): PublicErrorResponse => {
  if (isGtfsToHtmlError(error) || isGtfsError(error)) {
    return {
      error: error.message,
      code: error.code,
      category: error.category,
      statusCode: 400,
    };
  }

  if (error instanceof Error) {
    const downloadError = getDownloadErrorFromMessage(error.message);
    if (downloadError) {
      return {
        ...downloadError,
      };
    }

    return getServerErrorResponse();
  }

  return getServerErrorResponse();
};
