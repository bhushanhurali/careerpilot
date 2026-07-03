import { createMigrator } from './migrator.js';
import { sequelize } from './sequelize.js';

const command = process.argv[2];
const migrator = createMigrator();

if (command === 'up') {
  await migrator.up();
} else if (command === 'down') {
  await migrator.down();
} else {
  throw new Error('Usage: pnpm --filter @careerpilot/backend migrate:up|migrate:down');
}

await sequelize.close();
