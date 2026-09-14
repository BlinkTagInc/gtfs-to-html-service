import { publishPreview } from './timetable-preview.ts';
import type { TimetablePreview } from './preview-policy.ts';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

import { generateInWorker } from './generation-worker.ts';
import { cleanupGeneration } from './generation-files.ts';
import { getPublicGtfsErrorResponse } from './gtfs-error.ts';
import { publicGenerationMessage } from './public-generation-message.ts';
import type { GenerationEvent } from './generation-events.ts';

export const createGenerationEventStream = (
  config: Record<string, unknown>,
  tempDir: string,
  buildId: string,
  requestSignal: AbortSignal,
  deadline: number,
) => {
  const abort = new AbortController();
  const signal = AbortSignal.any([requestSignal, abort.signal]);
  const encoder = new TextEncoder();
  let complete = false;
  let agencies = '';
  let resolveFinished!: (result: {
    complete: boolean;
    agencies: string;
  }) => void;
  const finished = new Promise<{ complete: boolean; agencies: string }>(
    (resolve) => {
      resolveFinished = resolve;
    },
  );
  let cleanup: Promise<void> | undefined;
  const finish = () => {
    signal.removeEventListener('abort', onAbort);
    cleanup ??= cleanupGeneration(tempDir).then(() => {
      resolveFinished({ complete, agencies });
    });
    return cleanup;
  };

  async function* events(): AsyncGenerator<GenerationEvent> {
    try {
      signal.throwIfAborted();
      yield {
        type: 'log',
        level: 'info',
        message: 'Starting timetable generation…',
      };
      const queue: GenerationEvent[] = [];
      let wake: (() => void) | undefined;
      let settled = false;
      let failure: unknown;
      let timetablePath = '';
      let skipped = 0;
      const generation = generateInWorker(
        config,
        tempDir,
        signal,
        deadline,
        (log) => {
          // Coalesce repeated progress updates and bound buffering for slow clients.
          const last = queue.at(-1);
          if (log.overwrite && last?.type === 'log' && last.overwrite) {
            queue.pop();
          }
          if (queue.length >= 500) {
            queue.shift();
            skipped += 1;
          }
          queue.push({ type: 'log', ...log });
          wake?.();
        },
      )
        .then(
          (path) => {
            timetablePath = path;
          },
          (error) => {
            failure = error;
          },
        )
        .finally(() => {
          settled = true;
          wake?.();
        });
      try {
        while (!settled || queue.length > 0) {
          signal.throwIfAborted();
          const event = queue.shift();
          if (event) {
            yield event;
          } else {
            let heartbeat: ReturnType<typeof setTimeout> | undefined;
            await new Promise<void>((resolve) => {
              wake = resolve;
              heartbeat = setTimeout(resolve, 15_000);
            });
            clearTimeout(heartbeat);
            wake = undefined;
            if (!settled && queue.length === 0) {
              yield { type: 'heartbeat' };
            }
          }
        }
      } finally {
        // A cancelled response must stop the worker before deleting its files.
        if (!settled) {
          abort.abort();
        }
        await generation;
      }
      if (failure) {
        throw failure;
      }
      if (skipped) {
        yield {
          type: 'log',
          level: 'warning',
          message: `${skipped} earlier messages were omitted because the connection was slow.`,
        };
      }
      const log = await readFile(join(tempDir, buildId, 'log.txt'), 'utf8');
      agencies =
        log
          .split('\n')
          .find((line) => line.startsWith('Agencies: '))
          ?.slice(10) ?? '';
      let preview: TimetablePreview | undefined;
      yield {
        type: 'log',
        level: 'info',
        message: 'Publishing shareable timetable preview…',
      };
      try {
        preview = await publishPreview(
          join(tempDir, buildId),
          signal,
          agencies,
        );
      } catch (error) {
        console.error('Preview publication failed:', error);
        signal.throwIfAborted();
        yield {
          type: 'log',
          level: 'warning',
          message:
            'Preview could not be published. Your ZIP download is still available.',
        };
      }
      const { size } = await stat(timetablePath);
      yield { type: 'archive', agencies, size, preview };
      const file = createReadStream(timetablePath, {
        signal,
        highWaterMark: 48 * 1024,
      });
      try {
        for await (const chunk of file) {
          yield { type: 'chunk', data: (chunk as Buffer).toString('base64') };
        }
      } finally {
        file.destroy();
        if (!file.closed) {
          await new Promise<void>((resolve) => file.once('close', resolve));
        }
      }
      complete = true;
      yield { type: 'complete' };
    } catch (error) {
      console.error('Generation failed:', error);
      if (!signal.aborted) {
        const publicError = getPublicGtfsErrorResponse(error);
        yield {
          type: 'error',
          error: publicGenerationMessage(publicError.error),
          code: publicError.code,
          category: publicError.category,
        };
      }
    } finally {
      await finish();
    }
  }

  const iterator = events();
  const stop = async () => {
    signal.removeEventListener('abort', onAbort);
    abort.abort();
    await iterator.return(undefined);
    await finish();
  };
  const onAbort = () => {
    void stop();
  };
  signal.addEventListener('abort', onAbort, { once: true });
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await iterator.next();
      if (done) {
        controller.close();
      } else {
        controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
      }
    },
    async cancel() {
      await stop();
    },
  });
  if (signal.aborted) {
    void stop();
  }
  return { stream, finished };
};
