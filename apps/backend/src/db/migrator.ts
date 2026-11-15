import { dirname, resolve } from 'node:path';
import { readdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { SequelizeStorage, Umzug } from 'umzug';
import { QueryTypes } from 'sequelize';

import { sequelize } from './sequelize.js';

const currentDir = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(currentDir, 'migrations');

export async function verifyProductionMigrations(requireCurrent: boolean): Promise<void> {
  const files = (await readdir(migrationsDir)).filter((name) => name.endsWith('.js'));
  if (!files.length) throw new Error('Production requires compiled migrations');

  const [ledger] = await sequelize.query<{ ledger: string | null }>(
    `SELECT to_regclass('"SequelizeMeta"') AS ledger`,
    { type: QueryTypes.SELECT },
  );
  const applied = ledger?.ledger
    ? await sequelize.query<{ name: string }>('SELECT name FROM "SequelizeMeta"', {
        type: QueryTypes.SELECT,
      })
    : [];
  if (applied.some(({ name }) => !files.includes(name))) {
    throw new Error(
      'Migration ledger does not match the compiled release; check for source .ts entries or a newer release',
    );
  }
  if (requireCurrent && applied.length !== files.length) {
    throw new Error(
      'Database migrations are pending; run the compiled production migration command',
    );
  }
}

type MigrationModule = {
  up: (context: ReturnType<typeof sequelize.getQueryInterface>) => Promise<void>;
  down: (context: ReturnType<typeof sequelize.getQueryInterface>) => Promise<void>;
};

export function createMigrator(): Umzug<ReturnType<typeof sequelize.getQueryInterface>> {
  return new Umzug({
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
}
