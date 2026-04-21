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

const MAX_PUBLIC_MESSAGE_LENGTH = 400;

/**
 * Categories that represent server/infrastructure issues rather than problems
 * with the user's GTFS input. Surfacing the underlying message to the user is
 * unhelpful for these, so we swap in a generic server error message.
 */
const SERVER_ERROR_CATEGORIES = new Set(['database']);

/**
 * Error codes that should always be surfaced as a generic server error.
 * These typically indicate a deployment/environment problem (e.g. missing
 * native bindings) that the user cannot resolve.
 */
const SERVER_ERROR_CODES = new Set([
  'GTFS_TO_HTML_DATABASE_OPEN_FAILED',
  'GTFS_DATABASE_OPEN_FAILED',
]);

/**
 * Strip multi-line/verbose content from a library error message so it can be
 * safely shown in a UI toast. Keeps the first meaningful line and trims noise
 * like trailing colons, file paths, and stack traces.
 */
const sanitizePublicMessage = (message: string): string => {
  const firstLine = message.split(/\r?\n/, 1)[0]?.trim() ?? '';
  const withoutTrailingColon = firstLine.replace(/[:\s]+$/, '');

  if (!withoutTrailingColon) {
    return DEFAULT_SERVER_ERROR_MESSAGE;
  }

  if (withoutTrailingColon.length <= MAX_PUBLIC_MESSAGE_LENGTH) {
    return withoutTrailingColon;
  }

  return `${withoutTrailingColon.slice(0, MAX_PUBLIC_MESSAGE_LENGTH - 1).trimEnd()}…`;
};

export const getPublicGtfsErrorResponse = (
  error: unknown,
): PublicErrorResponse => {
  if (isGtfsToHtmlError(error) || isGtfsError(error)) {
    if (
      SERVER_ERROR_CODES.has(error.code) ||
      SERVER_ERROR_CATEGORIES.has(error.category)
    ) {
      return getServerErrorResponse();
    }

    return {
      error: sanitizePublicMessage(error.message),
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
