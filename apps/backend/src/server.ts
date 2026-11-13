import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { startReminderScheduler } from './modules/notifications/reminder.scheduler.js';

const app = createApp();
const stopReminderScheduler = startReminderScheduler();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'CareerPilot API started');
});

const shutdown = (signal: NodeJS.Signals) => {
  stopReminderScheduler();
  logger.info({ signal }, 'Shutting down CareerPilot API');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
