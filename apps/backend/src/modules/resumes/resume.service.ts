import { randomUUID } from 'node:crypto';
import { Transaction } from 'sequelize';

import { logger } from '../../config/logger.js';
import { ResumeModel } from '../../db/models/resume.model.js';
import { UserModel } from '../../db/models/user.model.js';
import { sequelize } from '../../db/sequelize.js';
import { HttpError } from '../../shared/errors/http-error.js';
import { parseResume } from './resume.parser.js';
import { processResumeCleanup } from './resume.cleanup.js';
import type { ResumeStorage } from './resume.storage.js';
import type { ResumeDto } from './resume.types.js';

function toDto(resume: ResumeModel): ResumeDto {
  return {
    id: resume.id,
    title: resume.title,
    originalFilename: resume.originalFilename,
    mimeType: resume.mimeType,
    fileSizeBytes: resume.fileSizeBytes,
    createdAt: resume.createdAt.toISOString(),
    updatedAt: resume.updatedAt.toISOString(),
  };
}

function persistenceError(): HttpError {
  return new HttpError(500, 'RESUME_STORAGE_ERROR', 'Could not complete the resume operation');
}

export class ResumesService {
  constructor(private readonly storage: ResumeStorage) {}

  async upload(userId: string, title: string, file: Express.Multer.File): Promise<ResumeDto> {
    const { mimeType, text } = await parseResume(file.buffer, file.originalname, file.mimetype);
    const storageKey = randomUUID();
    const id = randomUUID();
    const upload = { fileWritten: false };
    try {
      const resume = await sequelize.transaction(
        { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
        async (transaction) => {
          const owner = await UserModel.findByPk(userId, {
            attributes: ['id'],
            transaction,
            lock: transaction.LOCK.UPDATE,
          });
          if (!owner) throw new HttpError(404, 'USER_NOT_FOUND', 'User was not found');
          if ((await ResumeModel.count({ where: { userId }, transaction })) >= 10) {
            throw new HttpError(
              409,
              'RESUME_QUOTA_REACHED',
              'You can keep up to 10 active resumes',
            );
          }
          await this.storage.put(storageKey, file.buffer);
          upload.fileWritten = true;
          return ResumeModel.create(
            {
              id,
              userId,
              title,
              originalFilename: file.originalname,
              mimeType,
              fileSizeBytes: file.buffer.length,
              storageKey,
              extractedText: text,
            },
            { logging: false, transaction },
          );
        },
      );
      return toDto(resume);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      try {
        // A lost database acknowledgement can leave a committed row. Preserve its file.
        if (
          upload.fileWritten &&
          !(await ResumeModel.findByPk(id, { attributes: ['id'], paranoid: false }))
        ) {
          await this.storage.remove(storageKey);
        }
      } catch {
        logger.error({ resumeId: id }, 'Could not reconcile a failed resume upload');
      }
      throw persistenceError();
    }
  }

  async list(userId: string): Promise<ResumeDto[]> {
    const resumes = await ResumeModel.findAll({
      where: { userId },
      attributes: { exclude: ['extractedText', 'storageKey'] },
      order: [
        ['createdAt', 'DESC'],
        ['id', 'ASC'],
      ],
    });
    return resumes.map(toDto);
  }

  async get(userId: string, id: string): Promise<ResumeDto> {
    return toDto(await this.findOwned(userId, id));
  }

  async download(userId: string, id: string) {
    const resume = await this.findOwned(userId, id);
    try {
      return { resume: toDto(resume), stream: await this.storage.open(resume.storageKey) };
    } catch {
      throw persistenceError();
    }
  }

  async delete(userId: string, id: string): Promise<void> {
    const now = new Date();
    const [updated] = await ResumeModel.update(
      { deletedAt: now, extractedText: null, cleanupDueAt: now },
      { where: { id, userId, deletedAt: null }, paranoid: false, logging: false },
    );
    if (!updated) throw new HttpError(404, 'RESUME_NOT_FOUND', 'Resume was not found');

    // Revocation is committed independently. A failed attempt remains eligible for the worker.
    await processResumeCleanup(this.storage, id).catch(() => {
      logger.warn({ resumeId: id }, 'Could not attempt resume file cleanup');
    });
  }

  private async findOwned(userId: string, id: string): Promise<ResumeModel> {
    const resume = await ResumeModel.findOne({
      where: { id, userId },
      attributes: { exclude: ['extractedText'] },
    });
    if (!resume) throw new HttpError(404, 'RESUME_NOT_FOUND', 'Resume was not found');
    return resume;
  }
}
