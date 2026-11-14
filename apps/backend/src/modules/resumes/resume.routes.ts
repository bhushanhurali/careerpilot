import { Router, type RequestHandler } from 'express';
import multer from 'multer';

import { authenticate } from '../../middleware/authenticate.js';
import { HttpError } from '../../shared/errors/http-error.js';
import { ResumesController } from './resume.controller.js';
import { maxResumeBytes } from './resume.parser.js';
import { ResumesService } from './resume.service.js';
import { LocalResumeStorage } from './resume.storage.js';

const multipart = multer({
  storage: multer.memoryStorage(),
  preservePath: true,
  limits: { fileSize: maxResumeBytes + 1, files: 1, fields: 1, fieldSize: 1024, parts: 3 },
}).single('file');

const receiveResume: RequestHandler = (request, response, next) => {
  if (!request.is('multipart/form-data')) {
    next(
      new HttpError(415, 'RESUME_MULTIPART_REQUIRED', 'Use multipart/form-data to upload a resume'),
    );
    return;
  }
  multipart(request, response, (error?: unknown) => {
    if (!error) next();
    else if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      next(new HttpError(413, 'RESUME_TOO_LARGE', 'Resume must be at most 2 MiB'));
    } else {
      next(new HttpError(400, 'RESUME_INVALID_UPLOAD', 'Expected one resume file and a title'));
    }
  });
};

export function createResumesRouter(): Router {
  const router = Router();
  const controller = new ResumesController(new ResumesService(new LocalResumeStorage()));

  router.use(authenticate);
  router.use((_request, response, next) => {
    response.set('Cache-Control', 'private, no-store');
    next();
  });
  router.post('/', receiveResume, controller.upload);
  router.get('/', controller.list);
  router.get('/:resumeId', controller.get);
  router.get('/:resumeId/download', controller.download);
  router.delete('/:resumeId', controller.delete);

  return router;
}
