import { createReadStream } from 'node:fs';
import { rm } from 'node:fs/promises';

// Keep download/extraction and response streaming within the same per-instance
// admission limit as generation, so simultaneous inputs cannot fill /tmp first.
const state = globalThis as typeof globalThis & {
  gtfsJobDirectory?: string;
};

export const reserveGeneration = (tempDir: string) => {
  if (state.gtfsJobDirectory) {
    throw Object.assign(
      new Error('This instance is already processing a feed.'),
      {
        code: 'GENERATION_BUSY',
      },
    );
  }
  state.gtfsJobDirectory = tempDir;
};

export const cleanupGeneration = async (tempDir: string) => {
  try {
    await rm(tempDir, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 100,
    });
  } catch (error) {
    console.error('Error deleting generation directory:', tempDir, error);
  } finally {
    if (state.gtfsJobDirectory === tempDir) {
      state.gtfsJobDirectory = undefined;
    }
  }
};

export const createGenerationStream = (
  timetablePath: string,
  tempDir: string,
  signal: AbortSignal,
) => {
  const file = createReadStream(timetablePath, { signal });
  // Wait for the descriptor to close before trying to remove its directory.
  const closed = new Promise<void>((resolve) => {
    file.once('close', resolve);
  });
  const iterator = file[Symbol.asyncIterator]();
  let completed = false;
  let cleanup: Promise<void> | undefined;
  const finish = () => {
    cleanup ??= (async () => {
      file.destroy();
      await closed;
      await cleanupGeneration(tempDir);
    })();
    return cleanup;
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // These also run when a disconnected client stops pulling the stream.
      file.once('error', (error) => {
        void finish().then(() => controller.error(error));
      });
      file.once('close', () => {
        void finish();
      });
    },
    async pull(controller) {
      try {
        const { done, value } = await iterator.next();
        if (done) {
          await finish();
          completed = true;
          controller.close();
        } else {
          controller.enqueue(value);
        }
      } catch (error) {
        await finish();
        controller.error(error);
      }
    },
    async cancel() {
      await finish();
    },
  });

  return { stream, finish, isComplete: () => completed };
};
