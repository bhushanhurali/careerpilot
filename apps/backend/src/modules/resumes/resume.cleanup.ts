import { Op } from 'sequelize';

import { logger } from '../../config/logger.js';
import { ResumeModel } from '../../db/models/resume.model.js';
import { sequelize } from '../../db/sequelize.js';
import { LocalResumeStorage, type ResumeStorage } from './resume.storage.js';

const retryDelayMs = 60_000;

export async function processResumeCleanup(
  storage: ResumeStorage,
  resumeId?: string,
  now = new Date(),
): Promise<void> {
  const limit = resumeId ? 1 : 25;
  for (let index = 0; index < limit; index++) {
    const processed = await sequelize.transaction(async (transaction) => {
      const row = await ResumeModel.findOne({
        where: {
          ...(resumeId ? { id: resumeId } : {}),
          deletedAt: { [Op.ne]: null },
          cleanupDueAt: { [Op.lte]: now },
        },
        attributes: ['id', 'storageKey', 'cleanupDueAt'],
        paranoid: false,
        order: [
          ['cleanupDueAt', 'ASC'],
          ['id', 'ASC'],
        ],
        transaction,
        lock: transaction.LOCK.UPDATE,
        skipLocked: true,
        logging: false,
      });
      if (!row) return false;

      try {
        await storage.remove(row.storageKey);
      } catch (error) {
        if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) {
          logger.warn({ resumeId: row.id }, 'Resume file cleanup will be retried');
          await row.update(
            { cleanupDueAt: new Date(now.getTime() + retryDelayMs) },
            { transaction, logging: false },
          );
          return true;
        }
      }

      // A crash after removal leaves the marker intact; retrying a missing file is safe.
      await row.update({ cleanupDueAt: null }, { transaction, logging: false });
      return true;
    });
    if (!processed) break;
  }
}

export function startResumeCleanup(): () => void {
  const storage = new LocalResumeStorage();
  let running = false;
  const tick = () => {
    if (running) return;
    running = true;
    void processResumeCleanup(storage)
      .catch(() => logger.error('Could not process pending resume cleanup'))
      .finally(() => {
        running = false;
      });
  };
  const timer = setInterval(tick, retryDelayMs);
  timer.unref();
  tick();
  return () => clearInterval(timer);
}
