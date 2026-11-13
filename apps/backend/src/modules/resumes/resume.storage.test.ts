import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buffer } from 'node:stream/consumers';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LocalResumeStorage } from './resume.storage.js';

describe('local resume storage', () => {
  let root: string;
  let directory: string;
  let storage: LocalResumeStorage;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'careerpilot-resumes-'));
    directory = join(root, 'private');
    storage = new LocalResumeStorage(directory);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('preserves bytes across instances and never overwrites an existing key', async () => {
    const key = randomUUID();
    const content = Buffer.from([0, 42, 255]);
    await storage.put(key, content);
    await expect(storage.put(key, Buffer.from('replacement'))).rejects.toMatchObject({
      code: 'EEXIST',
    });

    const reopened = new LocalResumeStorage(directory);
    expect(await buffer(await reopened.open(key))).toEqual(content);
    await reopened.remove(key);
    await reopened.remove(key);
    await expect(storage.open(key)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects path traversal and client filenames for every operation', async () => {
    for (const key of ['../escape', '..\\escape', '/absolute', 'resume.pdf']) {
      await expect(storage.put(key, Buffer.from('test'))).rejects.toThrow(
        'Invalid resume storage key',
      );
      await expect(storage.open(key)).rejects.toThrow('Invalid resume storage key');
      await expect(storage.remove(key)).rejects.toThrow('Invalid resume storage key');
    }
  });
});
