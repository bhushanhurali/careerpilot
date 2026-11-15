import type { Server } from 'node:http';

import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { sequelize } from './db/sequelize.js';
import { startReminderScheduler } from './modules/notifications/reminder.scheduler.js';
import { startResumeCleanup } from './modules/resumes/resume.cleanup.js';
import { verifyReadiness } from './readiness.js';

let server: Server | undefined;
const stopping = new AbortController();
const stopWorkers: (() => Promise<void>)[] = [];
const shutdown = async (reason: string, exitCode = 0) => {
  if (stopping.signal.aborted) return;
  stopping.abort();
  logger.info({ reason }, 'Shutting down CareerPilot API');
  const deadline = setTimeout(() => {
    logger.error('API shutdown deadline exceeded');
    process.exit(1);
  }, 20_000);
  try {
    const listener = server;
    await Promise.all([
      ...stopWorkers.map((stop) => stop()),
      new Promise<void>((resolve, reject) => {
        if (!listener?.listening) return resolve();
        listener.close((error) => (error ? reject(error) : resolve()));
      }),
    ]);
    await sequelize.close();
    process.exitCode = exitCode;
    clearTimeout(deadline);
  } catch {
    logger.error('API shutdown failed');
    process.exitCode = 1;
  } finally {
    deadline.unref();
  }
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

try {
  if (env.NODE_ENV === 'production') await verifyReadiness(true);
  if (!stopping.signal.aborted) {
    server = createApp().listen(env.PORT, () => {
      if (stopping.signal.aborted) return;
      stopWorkers.push(startReminderScheduler(), startResumeCleanup());
      logger.info({ port: env.PORT }, 'CareerPilot API started');
    });
    server.on('error', () => void shutdown('HTTP listener failed', 1));
  }
} catch {
  logger.error(
    'Production startup checks failed; verify the database, migration ledger and resume mount',
  );
  await shutdown('startup check failed', 1);
}
