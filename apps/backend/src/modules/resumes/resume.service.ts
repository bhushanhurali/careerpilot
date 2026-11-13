import { randomUUID } from 'node:crypto';

import { logger } from '../../config/logger.js';
import { ResumeModel } from '../../db/models/resume.model.js';
import { HttpError } from '../../shared/errors/http-error.js';
import { parseResume } from './resume.parser.js';
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
    try {
      await this.storage.put(storageKey, file.buffer);
    } catch {
      throw persistenceError();
    }

    let resume: ResumeModel;
    try {
      resume = await ResumeModel.create(
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
        { logging: false },
      );
    } catch {
      try {
        // A lost database acknowledgement can leave a committed row. Preserve its file.
        if (!(await ResumeModel.findByPk(id, { attributes: ['id'], paranoid: false }))) {
          await this.storage.remove(storageKey);
        }
      } catch {
        logger.error({ resumeId: id }, 'Could not reconcile a failed resume upload');
      }
      throw persistenceError();
    }

    return toDto(resume);
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
    await (await this.findOwned(userId, id)).destroy();
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
