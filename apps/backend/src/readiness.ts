import { env } from './config/env.js';
import { verifyProductionMigrations } from './db/migrator.js';
import { sequelize } from './db/sequelize.js';
import { LocalResumeStorage } from './modules/resumes/resume.storage.js';

export async function verifyReadiness(probeWrite = false): Promise<void> {
  if (env.NODE_ENV !== 'production') {
    await sequelize.authenticate();
    return;
  }
  await verifyProductionMigrations(true);
  await new LocalResumeStorage().verifyMount(probeWrite);
}
