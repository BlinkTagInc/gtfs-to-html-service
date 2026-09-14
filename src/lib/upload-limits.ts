export const MAX_UPLOAD_BYTES = 50_000_000;
export const UPLOAD_PREFIX = 'gtfs-uploads/';
export const UPLOAD_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export const isUploadPathname = (value: unknown): value is string => {
  return (
    typeof value === 'string' &&
    /^gtfs-uploads\/[0-9a-f-]{36}\.zip$/.test(value)
  );
};
