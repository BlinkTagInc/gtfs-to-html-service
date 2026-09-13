import { parentPort, workerData } from 'node:worker_threads';

// Error structured cloning drops custom fields used by our public error mapper.
const serializeError = (error, depth = 0) => {
  if (!(error instanceof Error) || depth >= 5) {
    return undefined;
  }

  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    code: error.code,
    category: error.category,
    isOperational: error.isOperational,
    statusCode: error.statusCode,
    details: error.details,
    cause: serializeError(error.cause, depth + 1),
  };
};

try {
  const { default: gtfsToHtml } = await import('gtfs-to-html');
  const timetablePath = await gtfsToHtml({
    ...workerData.config,
    sqlitePath: ':memory:',
    deleteDbAfter: true,
    skipImport: false,
    zipOutput: true,
    logLevel: 'info',
    verbose: true,
    logFunction: (message, levelOrOverwrite) => {
      const text = message instanceof Error ? message.message : String(message);
      parentPort.postMessage({
        log: {
          message: text.slice(0, 8000),
          level: ['warning', 'error'].includes(levelOrOverwrite)
            ? levelOrOverwrite
            : 'info',
          overwrite: levelOrOverwrite === true,
        },
      });
    },
    log: () => {},
    logWarning: () => {},
    logError: () => {},
  });
  parentPort.postMessage({ timetablePath });
} catch (error) {
  parentPort.postMessage({
    error: serializeError(error) ?? {
      name: 'Error',
      message: 'Timetable generation failed.',
    },
  });
}
