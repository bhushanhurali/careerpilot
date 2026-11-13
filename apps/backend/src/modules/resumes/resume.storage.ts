import { constants } from 'node:fs';
import { lstat, mkdir, open, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Readable } from 'node:stream';

import { env } from '../../config/env.js';

const storageKeyPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export type ResumeStorage = {
  put(key: string, content: Uint8Array): Promise<void>;
  open(key: string): Promise<Readable>;
  remove(key: string): Promise<void>;
};

export class LocalResumeStorage implements ResumeStorage {
  private readonly directory: string;

  constructor(directory = env.RESUME_STORAGE_DIR) {
    this.directory = resolve(directory);
  }

  async put(key: string, content: Uint8Array): Promise<void> {
    const path = this.pathFor(key);
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const file = await open(path, 'wx', 0o600);

    try {
      try {
        await file.writeFile(content);
      } finally {
        await file.close();
      }
    } catch (error) {
      await rm(path, { force: true }).catch(() => undefined);
      throw error;
    }
  }

  async open(key: string): Promise<Readable> {
    const path = this.pathFor(key);
    if (!(await lstat(path)).isFile()) {
      throw new Error('Resume storage entry is not a regular file');
    }

    const flags =
      process.platform === 'win32' ? constants.O_RDONLY : constants.O_RDONLY | constants.O_NOFOLLOW;
    const file = await open(path, flags);
    return file.createReadStream();
  }

  async remove(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  private pathFor(key: string): string {
    if (!storageKeyPattern.test(key)) {
      throw new Error('Invalid resume storage key');
    }

    return join(this.directory, key);
  }
}
