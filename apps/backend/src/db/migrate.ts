import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { SequelizeStorage, Umzug } from 'umzug';

import { sequelize } from './sequelize.js';

const currentDir = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(currentDir, 'migrations');

type MigrationModule = {
  up: (context: ReturnType<typeof sequelize.getQueryInterface>) => Promise<void>;
  down: (context: ReturnType<typeof sequelize.getQueryInterface>) => Promise<void>;
};

const umzug = new Umzug({
  migrations: {
    glob: ['*.{js,ts}', { cwd: migrationsDir }],
    resolve: ({ name, path, context }) => {
      if (!path) {
        throw new Error(`Migration ${name} does not have a path`);
      }

      return {
        name,
        up: async () => {
          const migration = (await import(pathToFileURL(path).href)) as MigrationModule;
          await migration.up(context);
        },
        down: async () => {
          const migration = (await import(pathToFileURL(path).href)) as MigrationModule;
          await migration.down(context);
        },
      };
    },
  },
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize }),
  logger: console,
});

const command = process.argv[2];

if (command === 'up') {
  await umzug.up();
} else if (command === 'down') {
  await umzug.down();
} else {
  throw new Error('Usage: pnpm --filter @careerpilot/backend migrate:up|migrate:down');
}

await sequelize.close();
