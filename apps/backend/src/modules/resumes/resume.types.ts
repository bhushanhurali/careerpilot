import type { ResumeMimeType } from '../../db/models/resume.model.js';

export type ResumeDto = {
  id: string;
  title: string;
  originalFilename: string;
  mimeType: ResumeMimeType;
  fileSizeBytes: number;
  createdAt: string;
  updatedAt: string;
};
