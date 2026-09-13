import { createReadStream } from 'node:fs';
import { rm } from 'node:fs/promises';

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
