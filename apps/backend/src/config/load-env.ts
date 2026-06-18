import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';

const currentDir = dirname(fileURLToPath(import.meta.url));

export const rootEnvPath = resolve(currentDir, '../../../..', '.env');

export function loadRootEnv(): void {
  dotenv.config({ path: rootEnvPath });
}
