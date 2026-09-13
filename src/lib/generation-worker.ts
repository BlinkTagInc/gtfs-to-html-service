import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import type { GenerationLog } from './generation-events.ts';
import { publicGenerationMessage } from './public-generation-message.ts';

// Leave 20 seconds of the routes' 800-second budget for termination and cleanup.
export const GENERATION_TIMEOUT_MS = 780_000;

const generationTimeout = () => {
  return Object.assign(new Error('Timetable generation timed out.'), {
    code: 'GENERATION_TIMEOUT',
  });
};

type SerializedError = {
  name: string;
  message: string;
  stack?: string;
  code?: string;
  category?: string;
  isOperational?: boolean;
  statusCode?: number;
  details?: Record<string, unknown>;
  cause?: SerializedError;
};

const deserializeError = (error: SerializedError): Error => {
  return Object.assign(new Error(error.message), {
    ...error,
    cause: error.cause ? deserializeError(error.cause) : undefined,
  });
};

// Share the limit between route bundles in the same JavaScript environment.
const state = globalThis as typeof globalThis & {
  gtfsGenerationActive?: boolean;
};

export const generateInWorker = async (
  config: Record<string, unknown>,
  tempDir: string,
  signal: AbortSignal,
  deadline = Date.now() + GENERATION_TIMEOUT_MS,
  onLog?: (log: GenerationLog) => void,
): Promise<string> => {
  signal.throwIfAborted();
  if (deadline <= Date.now()) {
    throw generationTimeout();
  }
  if (state.gtfsGenerationActive) {
    throw Object.assign(
      new Error('This instance is already generating timetables.'),
      {
        code: 'GENERATION_BUSY',
      },
    );
  }

  state.gtfsGenerationActive = true;
  let worker: Worker | undefined;
  let onAbort: (() => void) | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const generationWorker = new Worker(
      join(process.cwd(), 'workers/generate.mjs'),
      {
        workerData: {
          config,
        },
        // Keep importer scratch files inside this job's cleanup directory too.
        env: { ...process.env, TMPDIR: tempDir, TMP: tempDir, TEMP: tempDir },
      },
    );

    worker = generationWorker;

    return await new Promise<string>((resolve, reject) => {
      timeout = setTimeout(
        () => reject(generationTimeout()),
        Math.max(0, deadline - Date.now()),
      );
      onAbort = () => reject(signal.reason);
      signal.addEventListener('abort', onAbort, { once: true });
      generationWorker.on(
        'message',
        (message: {
          timetablePath?: string;
          error?: SerializedError;
          log?: GenerationLog;
        }) => {
          if (message.log) {
            const text = publicGenerationMessage(message.log.message);
            if (text) {
              onLog?.({ ...message.log, message: text });
            }
          } else if (message.error) {
            reject(deserializeError(message.error));
          } else if (message.timetablePath) {
            resolve(message.timetablePath);
          } else {
            reject(new Error('Generation worker returned an invalid result.'));
          }
        },
      );
      generationWorker.once('error', reject);
      generationWorker.once('exit', (code) => {
        reject(
          new Error(
            `Generation worker exited without a result (code ${code}).`,
          ),
        );
      });
      if (signal.aborted) {
        onAbort();
      }
    });
  } finally {
    clearTimeout(timeout);
    if (onAbort) {
      signal.removeEventListener('abort', onAbort);
    }
    try {
      await worker?.terminate();
    } finally {
      state.gtfsGenerationActive = false;
    }
  }
};
