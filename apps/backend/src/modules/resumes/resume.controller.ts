import { pipeline } from 'node:stream/promises';

import type { Request, RequestHandler } from 'express';

import { HttpError } from '../../shared/errors/http-error.js';
import { ok } from '../../shared/responses/api-response.js';
import { parseRequestBody, parseRequestParams } from '../../shared/validation/parse-request.js';
import { resumeIdParams, resumeUploadBody } from './resume.schemas.js';
import { ResumesService } from './resume.service.js';

function owner(request: Request): string {
  if (!request.auth) throw new Error('Authentication middleware did not attach auth context');
  return request.auth.userId;
}

export class ResumesController {
  constructor(private readonly service: ResumesService) {}

  upload: RequestHandler = async (request, response) => {
    const { title } = parseRequestBody(resumeUploadBody, request.body);
    if (!request.file) throw new HttpError(400, 'RESUME_FILE_REQUIRED', 'Resume file is required');
    const resume = await this.service.upload(owner(request), title, request.file);
    response.status(201).json(ok({ resume }));
  };

  list: RequestHandler = async (request, response) => {
    response.json(ok({ resumes: await this.service.list(owner(request)) }));
  };

  get: RequestHandler = async (request, response) => {
    const { resumeId } = parseRequestParams(resumeIdParams, request.params);
    response.json(ok({ resume: await this.service.get(owner(request), resumeId) }));
  };

  download: RequestHandler = async (request, response) => {
    const { resumeId } = parseRequestParams(resumeIdParams, request.params);
    const { resume, stream } = await this.service.download(owner(request), resumeId);
    response.attachment(resume.originalFilename);
    response.set({
      'Content-Type': resume.mimeType,
      'Content-Length': String(resume.fileSizeBytes),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    try {
      await pipeline(stream, response);
    } catch {
      // A stream failure may include a filesystem path. Never forward it to the error logger.
      response.destroy();
    }
  };

  delete: RequestHandler = async (request, response) => {
    const { resumeId } = parseRequestParams(resumeIdParams, request.params);
    await this.service.delete(owner(request), resumeId);
    response.json(ok({ deleted: true }));
  };
}
