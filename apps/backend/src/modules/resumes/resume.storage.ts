import { constants } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { access, lstat, mkdir, open, readFile, realpath, rm } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
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

  async verifyMount(probeWrite = false): Promise<void> {
    if (env.NODE_ENV !== 'production') return;
    try {
      if (
        !env.RESUME_STORAGE_ID ||
        !isAbsolute(env.RESUME_STORAGE_DIR) ||
        process.platform !== 'linux'
      ) {
        throw new Error('Production storage requires an identified Linux mount');
      }
      const mountInfo = await readFile('/proc/self/mountinfo', 'utf8');
      const mounted = mountInfo
        .split('\n')
        .some(
          (line) =>
            line
              .split(' ')[4]
              ?.replace(/\\([0-7]{3})/g, (_, octal: string) =>
                String.fromCharCode(parseInt(octal, 8)),
              ) === this.directory,
        );
      const directory = await lstat(this.directory);
      if (
        !mounted ||
        !directory.isDirectory() ||
        (await realpath(this.directory)) !== this.directory ||
        directory.uid !== process.getuid?.() ||
        (directory.mode & 0o077) !== 0
      ) {
        throw new Error('Storage requires a private mount owned by the API user');
      }
      const marker = await open(
        join(this.directory, '.storage-id'),
        constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
      );
      try {
        const stat = await marker.stat();
        if (
          !stat.isFile() ||
          stat.size > 64 ||
          (await marker.readFile('utf8')).trim() !== env.RESUME_STORAGE_ID
        ) {
          throw new Error('Storage identity mismatch');
        }
      } finally {
        await marker.close();
      }
      await access(this.directory, constants.R_OK | constants.W_OK | constants.X_OK);
      if (probeWrite) {
        const probe = join(this.directory, `.probe-${randomUUID()}`);
        const file = await open(probe, 'wx', 0o600);
        try {
          await file.close();
        } finally {
          await rm(probe);
        }
      }
    } catch {
      // A missing mount or marker must not look like a missing resume to cleanup.
      throw new Error(
        'Private resume storage mount is unavailable or does not match its configured identity',
      );
    }
  }

  async put(key: string, content: Uint8Array): Promise<void> {
    const path = this.pathFor(key);
    if (env.NODE_ENV === 'production') await this.verifyMount();
    else await mkdir(this.directory, { recursive: true, mode: 0o700 });
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
    await this.verifyMount();
    if (!(await lstat(path)).isFile()) {
      throw new Error('Resume storage entry is not a regular file');
    }

    const flags =
      process.platform === 'win32' ? constants.O_RDONLY : constants.O_RDONLY | constants.O_NOFOLLOW;
    const file = await open(path, flags);
    return file.createReadStream();
  }

  async remove(key: string): Promise<void> {
    await this.verifyMount();
    await rm(this.pathFor(key), { force: true });
    await this.verifyMount();
  }

  private pathFor(key: string): string {
    if (!storageKeyPattern.test(key)) {
      throw new Error('Invalid resume storage key');
    }

    return join(this.directory, key);
  }
}
