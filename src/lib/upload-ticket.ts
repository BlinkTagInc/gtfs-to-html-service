import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { isUploadPathname, UPLOAD_PREFIX } from './upload-limits.ts';

const sign = (value: string) => {
  const secret = process.env.BLOB_READ_WRITE_TOKEN;
  if (!secret) {
    throw new Error('Blob uploads are not configured.');
  }
  return createHmac('sha256', secret).update(value).digest('hex');
};

export const createUploadTicket = () => {
  const pathname = `${UPLOAD_PREFIX}${randomUUID()}.zip`;
  const expires = Date.now() + 60 * 60 * 1000;
  return { pathname, ticket: `${expires}.${sign(`${pathname}:${expires}`)}` };
};

export const verifyUploadTicket = (pathname: unknown, ticket: unknown) => {
  if (!isUploadPathname(pathname) || typeof ticket !== 'string') {
    return false;
  }
  const match = /^(\d{13})\.([0-9a-f]{64})$/.exec(ticket);
  if (!match || Number(match[1]) <= Date.now()) {
    return false;
  }
  return timingSafeEqual(
    Buffer.from(match[2], 'hex'),
    Buffer.from(sign(`${pathname}:${match[1]}`), 'hex'),
  );
};
