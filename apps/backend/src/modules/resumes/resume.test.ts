import { randomUUID } from 'node:crypto';

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createMigrator } from '../../db/migrator.js';
import { ResumeModel, resumeMimeTypes } from '../../db/models/resume.model.js';
import { UserModel } from '../../db/models/user.model.js';
import { sequelize } from '../../db/sequelize.js';

function createUser() {
  return UserModel.create({
    id: randomUUID(),
    email: `${randomUUID()}@example.com`,
    passwordHash: 'test-password-hash',
    firstName: 'Test',
    lastName: 'User',
  });
}

function createResume(userId: string, values: Partial<ResumeModel> = {}) {
  return ResumeModel.create({
    id: randomUUID(),
    userId,
    title: '  Backend resume  ',
    originalFilename: 'Resume.pdf',
    mimeType: resumeMimeTypes[0],
    fileSizeBytes: 400,
    storageKey: randomUUID(),
    ...values,
  });
}

describe('resume database foundation', () => {
  beforeAll(async () => {
    await createMigrator().up();
  });

  beforeEach(async () => {
    await sequelize.query('TRUNCATE TABLE resumes, users RESTART IDENTITY CASCADE;');
  });

  it('associates multiple PDF and DOCX records with their owner and trims the title', async () => {
    const owner = await createUser();
    const other = await createUser();
    const pdf = await createResume(owner.id);
    const docx = await createResume(owner.id, {
      mimeType: resumeMimeTypes[1],
      originalFilename: 'Resume.docx',
    });
    await createResume(other.id);
    await owner.reload({ include: ['resumes'] });
    await pdf.reload({ include: ['user'] });

    const resumes = owner.get('resumes') as ResumeModel[];
    expect(resumes.map(({ id }) => id).sort()).toEqual([pdf.id, docx.id].sort());
    expect(pdf.get('user')).toMatchObject({ id: owner.id });
    expect(pdf).toMatchObject({
      title: 'Backend resume',
      originalFilename: 'Resume.pdf',
      fileSizeBytes: 400,
    });
  });

  it('hides soft-deleted metadata and blocks hard deletion of its owner', async () => {
    const owner = await createUser();
    const resume = await createResume(owner.id);
    await resume.destroy();

    expect(await ResumeModel.findByPk(resume.id)).toBeNull();
    expect((await ResumeModel.findByPk(resume.id, { paranoid: false }))?.deletedAt).toBeInstanceOf(
      Date,
    );
    await expect(owner.destroy({ force: true })).rejects.toMatchObject({
      parent: { code: '23503' },
    });
  });

  it('rejects missing owners, invalid metadata, and reused storage keys at the database layer', async () => {
    const owner = await createUser();
    const resume = await createResume(owner.id);
    const insert = (values: Record<string, string | number>) =>
      sequelize.query(
        `INSERT INTO resumes
          (id, user_id, title, original_filename, mime_type, file_size_bytes, storage_key, created_at, updated_at)
         VALUES (:id, :userId, :title, :filename, :mime, :size, :key, now(), now());`,
        {
          replacements: {
            id: randomUUID(),
            userId: owner.id,
            title: 'Resume',
            filename: 'Resume.pdf',
            mime: resumeMimeTypes[0],
            size: 400,
            key: randomUUID(),
            ...values,
          },
        },
      );

    await expect(insert({ userId: randomUUID() })).rejects.toMatchObject({
      parent: { code: '23503' },
    });
    for (const [values, constraint] of [
      [{ title: '   ' }, 'resumes_names_not_blank_check'],
      [{ filename: ' \t ' }, 'resumes_names_not_blank_check'],
      [{ mime: 'image/png' }, 'resumes_mime_type_check'],
      [{ size: 0 }, 'resumes_file_size_positive_check'],
      [{ key: '00000000-0000-0000-0000-000000000000' }, 'resumes_storage_key_v4_check'],
      [{ key: resume.storageKey }, 'resumes_storage_key_unique'],
    ] as const) {
      await expect(insert(values)).rejects.toMatchObject({ parent: { constraint } });
    }
  });
});
