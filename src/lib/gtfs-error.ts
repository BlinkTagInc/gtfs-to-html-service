import { SecurityError } from './security-error.ts';
import { publicGenerationMessage } from './public-generation-message.ts';
import { isGtfsToHtmlError, isGtfsError, type GtfsError } from 'gtfs-to-html';

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

const MAX_CAUSE_CHAIN_DEPTH = 5;

/**
 * A fetch failure can report a timeout at several layers, each wrapping the
 * next in `.cause`:
 *  - `AbortSignal.timeout()` firing rejects with a DOMException named
 *    `TimeoutError`.
 *  - undici's own connect/headers/body timeouts reject with a
 *    `TypeError: fetch failed`, whose `.cause` is a `ConnectTimeoutError`,
 *    `HeadersTimeoutError`, or `BodyTimeoutError` (code starting
 *    `UND_ERR_..._TIMEOUT`).
 * so we walk the whole cause chain rather than only the top level.
 */
const isTimeoutCause = (cause: unknown, depth = 0): boolean => {
  if (!(cause instanceof Error) || depth >= MAX_CAUSE_CHAIN_DEPTH) {
    return false;
  }

  const code = (cause as { code?: unknown }).code;
  const isTimeout =
    /timeout/i.test(cause.name) ||
    (typeof code === 'string' && /timeout/i.test(code)) ||
    /timeout/i.test(cause.message);

  if (isTimeout) {
    return true;
  }

  return isTimeoutCause(cause.cause, depth + 1);
};

/**
 * `gtfsToHtml` throws a `GtfsError` (category `download`) whenever fetching
 * the user-provided URL fails. The failing URL and, for HTTP failures, the
 * upstream status code are available on `error.details`/`error.statusCode`
 * rather than needing to be parsed back out of the message. For non-HTTP
 * failures (DNS, connection refused, timeout, ...) `error.cause` holds the
 * underlying fetch error (and its own `.cause` chain), which we inspect
 * only to detect a timeout - the underlying message is never shown to the
 * user.
 */
const getDownloadFailureResponse = (error: GtfsError): PublicErrorResponse => {
  const details = error.details;
  const url = typeof details?.url === 'string' ? details.url : undefined;
  const urlSuffix = url ? ` URL tried: ${url}` : '';

  if (error.code === 'GTFS_DOWNLOAD_HTTP') {
    const status =
      typeof error.statusCode === 'number'
        ? error.statusCode
        : typeof details?.status === 'number'
          ? details.status
          : undefined;
    const statusCode = status !== undefined && status >= 500 ? 502 : 400;

    return {
      error: `Unable to download GTFS: server responded with HTTP ${status ?? 'error'}.${urlSuffix}`,
      code: 'DOWNLOAD_HTTP_ERROR',
      category: 'download',
      statusCode,
    };
  }

  if (isTimeoutCause(error.cause)) {
    return {
      error: `Timed out while trying to download GTFS. The source server took too long to respond.${urlSuffix}`,
      code: 'DOWNLOAD_TIMEOUT',
      category: 'download',
      statusCode: 400,
    };
  }

  return {
    error: `Unable to download GTFS. Please verify the URL is correct and publicly accessible.${urlSuffix}`,
    code: 'DOWNLOAD_FAILED',
    category: 'download',
    statusCode: 400,
  };
};

const MAX_PUBLIC_MESSAGE_LENGTH = 400;

/**
 * Infrastructure failures retain a server status, but still expose the known
 * GTFS error message. Database constraints can instead indicate invalid input.
 */
const SERVER_ERROR_CODES = new Set([
  'DB_OPEN_FAILED',
  'GTFS_TO_HTML_DATABASE_OPEN_FAILED',
  'GTFS_DATABASE_OPEN_FAILED',
]);

/**
 * Strip multi-line/verbose content from a library error message so it can be
 * safely shown in a UI status message. Keeps the first meaningful line and trims noise
 * like trailing colons, file paths, and stack traces.
 */
const sanitizePublicMessage = (message: string): string => {
  const firstLine =
    publicGenerationMessage(message).split(/\r?\n/, 1)[0]?.trim() ?? '';
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
  if (error instanceof SecurityError) {
    return {
      error: error.message,
      code: 'INPUT_REJECTED',
      category: 'request',
      statusCode: error.statusCode,
    };
  }
  if (
    error instanceof Error &&
    ['GENERATION_RESOURCE_LIMIT', 'ERR_WORKER_OUT_OF_MEMORY'].includes(
      (error as { code?: string }).code ?? '',
    )
  ) {
    return {
      error:
        'This feed exceeds the online processing limits. Use the command-line tool for this feed.',
      code: 'GENERATION_RESOURCE_LIMIT',
      category: 'request',
      statusCode: 413,
    };
  }
  if (
    error instanceof Error &&
    (error as { code?: string }).code === 'PDF_DISABLED'
  ) {
    return {
      error:
        'Server-side PDF generation is unavailable. Generate HTML and print it to PDF locally.',
      code: 'PDF_DISABLED',
      category: 'request',
      statusCode: 400,
    };
  }

  if (
    error instanceof Error &&
    (error as { code?: string }).code === 'GENERATION_TIMEOUT'
  ) {
    return {
      error:
        'Timetable generation took too long. Please try a smaller GTFS feed.',
      code: 'GENERATION_TIMEOUT',
      category: 'server',
      statusCode: 504,
    };
  }

  if (
    error instanceof Error &&
    (error as { code?: string }).code === 'GENERATION_BUSY'
  ) {
    return {
      error:
        'The server is busy generating timetables. Please try again shortly.',
      code: 'GENERATION_BUSY',
      category: 'server',
      statusCode: 503,
    };
  }

  if (isGtfsToHtmlError(error) || isGtfsError(error)) {
    const file =
      typeof error.details?.file === 'string'
        ? error.details.file.split(/[\\/]/).at(-1)
        : undefined;
    const line = error.details?.line;
    const location = [
      file,
      typeof line === 'number' && Number.isSafeInteger(line) && line > 0
        ? `line ${line}`
        : undefined,
    ]
      .filter(Boolean)
      .join(', ');
    const message = sanitizePublicMessage(
      location ? `${location}: ${error.message}` : error.message,
    );

    if (error.category === 'download') {
      const downloadError = getDownloadFailureResponse(error);
      return {
        ...downloadError,
        error: `${message} ${publicGenerationMessage(downloadError.error)}`,
      };
    }

    return {
      error: message,
      code: error.code,
      category: error.category,
      statusCode: SERVER_ERROR_CODES.has(error.code) ? 500 : 400,
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
