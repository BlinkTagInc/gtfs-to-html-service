import type { TimetablePreview } from './preview-policy.ts';
import type { GenerationEvent, GenerationLog } from './generation-events';

export type GenerationResult =
  | { blob: Blob; agencies: string; preview?: TimetablePreview }
  | { error: string; code: string; category: string };

export const readGenerationStream = async (
  response: Response,
  onLog: (log: GenerationLog) => void,
): Promise<GenerationResult> => {
  if (!response.body) {
    throw new Error('Generation response has no body.');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let pending = '';
  let size: number | undefined;
  let received = 0;
  let agencies = '';
  let preview: TimetablePreview | undefined;
  let complete = false;
  let failure: GenerationResult | undefined;
  const handle = (line: string) => {
    const event = JSON.parse(line) as GenerationEvent;
    if (complete || failure) {
      throw new Error('Unexpected data after generation finished.');
    }
    switch (event.type) {
      case 'log':
        onLog(event);
        break;
      case 'heartbeat':
        break;
      case 'archive':
        if (
          size !== undefined ||
          !Number.isSafeInteger(event.size) ||
          event.size < 0
        ) {
          throw new Error('Invalid archive metadata.');
        }
        size = event.size;
        agencies = event.agencies;
        preview = event.preview;
        break;
      case 'chunk': {
        if (size === undefined) {
          throw new Error('Archive data arrived before its metadata.');
        }
        const chunk = Uint8Array.from(atob(event.data), (character) =>
          character.charCodeAt(0),
        );
        received += chunk.length;
        if (received > size) {
          throw new Error('Archive exceeds its expected size.');
        }
        chunks.push(chunk);
        break;
      }
      case 'complete':
        complete = true;
        break;
      case 'error':
        failure = {
          error: event.error,
          code: event.code,
          category: event.category,
        };
        break;
      default:
        throw new Error('Invalid generation event.');
    }
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      let newline: number;
      while ((newline = pending.indexOf('\n')) >= 0) {
        const line = pending.slice(0, newline);
        pending = pending.slice(newline + 1);
        if (line) {
          handle(line);
        }
      }
      if (pending.length > 100_000) {
        throw new Error('Generation event is too large.');
      }
      if (done) {
        break;
      }
    }
    if (pending.trim()) {
      throw new Error('Incomplete generation event.');
    }
    if (failure) {
      return failure;
    }
    if (!complete || size === undefined || size !== received) {
      throw new Error('Generation stream ended before the download completed.');
    }
    return {
      blob: new Blob(chunks, { type: 'application/zip' }),
      agencies,
      preview,
    };
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
};
