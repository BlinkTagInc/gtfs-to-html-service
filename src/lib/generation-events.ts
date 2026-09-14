import type { TimetablePreview } from './preview-policy.ts';
export const GENERATION_STREAM_TYPE = 'application/x-ndjson';

export type GenerationLog = {
  message: string;
  level: 'info' | 'warning' | 'error';
  overwrite?: boolean;
};

export type GenerationEvent =
  | ({ type: 'log' } & GenerationLog)
  | { type: 'heartbeat' }
  | {
      type: 'archive';
      agencies: string;
      size: number;
      preview?: TimetablePreview;
    }
  | { type: 'chunk'; data: string }
  | { type: 'complete' }
  | { type: 'error'; error: string; code: string; category: string };
