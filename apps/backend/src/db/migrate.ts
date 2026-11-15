import { env } from '../config/env.js';
import { createMigrator, verifyProductionMigrations } from './migrator.js';
import { sequelize } from './sequelize.js';

const command = process.argv[2];
const migrator = createMigrator();

try {
  if (env.NODE_ENV === 'production') {
    if (command !== 'up') throw new Error('Production supports only compiled migration up');
    await verifyProductionMigrations(false);
  }
  if (command === 'up') await migrator.up();
  else if (command === 'down') await migrator.down();
  else throw new Error('Usage: pnpm --filter @careerpilot/backend migrate:up|migrate:down');
} finally {
  await sequelize.close();
}
