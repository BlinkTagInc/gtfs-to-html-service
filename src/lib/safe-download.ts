import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { request as httpRequest, type IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import ipaddr from 'ipaddr.js';
import { MAX_UPLOAD_BYTES } from './upload-limits.ts';
import { SecurityError } from './security-error.ts';

export const isPublicAddress = (address: string) => {
  if (!ipaddr.isValid(address)) {
    return false;
  }
  // Includes rejection of IPv4-mapped IPv6 loopback/private addresses.
  return ipaddr.process(address).range() === 'unicast';
};

export const validateDownloadUrl = (value: string) => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new SecurityError(
      'Please provide a valid public HTTP or HTTPS GTFS URL.',
    );
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.port && url.port !== (url.protocol === 'https:' ? '443' : '80'))
  ) {
    throw new SecurityError(
      'GTFS URLs must use public HTTP or HTTPS on standard ports without credentials.',
    );
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(hostname) && !isPublicAddress(hostname)) {
    throw new SecurityError(
      'GTFS URLs must point to a public internet address.',
    );
  }
  return url;
};

export const resolvePublicAddress = async (url: URL) => {
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) }]
    : await lookup(hostname, { all: true });
  if (
    !addresses.length ||
    addresses.some(({ address }) => !isPublicAddress(address))
  ) {
    throw new SecurityError(
      'GTFS URLs must point to a public internet address.',
    );
  }
  return addresses[0];
};

const openDownload = async (
  url: URL,
  signal: AbortSignal,
): Promise<IncomingMessage> => {
  const address = await resolvePublicAddress(url);
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(
      url,
      {
        // Keep the original hostname for Host/SNI/certificate verification, but
        // force the socket to the address already checked. Never resolve twice.
        lookup: (_hostname, options, callback) => {
          if (options.all) {
            callback(null, [address]);
          } else {
            callback(null, address.address, address.family);
          }
        },
        agent: false,
        signal,
        headers: {
          'Accept-Encoding': 'identity',
          'User-Agent': 'gtfs-to-html-service',
        },
      },
      resolve,
    );
    request.on('error', reject);
    request.end();
  });
};

export const downloadPublicGtfs = async (
  value: string,
  destination: string,
  requestSignal: AbortSignal,
) => {
  const signal = AbortSignal.any([requestSignal, AbortSignal.timeout(60_000)]);
  let url = validateDownloadUrl(value);
  for (let redirects = 0; redirects <= 5; redirects++) {
    const response = await openDownload(url, signal);
    if ([301, 302, 303, 307, 308].includes(response.statusCode ?? 0)) {
      const location = response.headers.location;
      response.destroy();
      if (!location || redirects === 5) {
        throw new SecurityError(
          'GTFS download has too many or invalid redirects.',
        );
      }
      url = validateDownloadUrl(new URL(location, url).href);
      continue;
    }
    if (
      response.statusCode !== 200 ||
      (response.headers['content-encoding'] &&
        response.headers['content-encoding'] !== 'identity')
    ) {
      response.destroy();
      throw new SecurityError(
        'Unable to download an unencoded GTFS ZIP from this URL.',
      );
    }
    if (Number(response.headers['content-length']) > MAX_UPLOAD_BYTES) {
      response.destroy();
      throw new SecurityError('GTFS downloads must be 50 MB or smaller.', 413);
    }
    let bytes = 0;
    await pipeline(
      response,
      async function* (source) {
        for await (const chunk of source) {
          bytes += chunk.length;
          if (bytes > MAX_UPLOAD_BYTES) {
            throw new SecurityError(
              'GTFS downloads must be 50 MB or smaller.',
              413,
            );
          }
          yield chunk;
        }
      },
      createWriteStream(destination, { flags: 'wx' }),
      { signal },
    );
    return;
  }
};
