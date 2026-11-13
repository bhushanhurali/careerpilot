import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../app.js';
import { createMigrator } from '../../db/migrator.js';
import { CompanyModel } from '../../db/models/company.model.js';
import { JobApplicationModel } from '../../db/models/job-application.model.js';
import { ResumeModel } from '../../db/models/resume.model.js';
import { UserModel } from '../../db/models/user.model.js';
import { sequelize } from '../../db/sequelize.js';
import type { ApiResponse } from '../../shared/responses/api-response.js';
import { signAccessToken } from '../../shared/security/jwt.js';
import type { JobApplicationDto } from './applications.types.js';

const app = createApp();
const base = '/api/v1/applications';

async function owner() {
  const id = randomUUID();
  await UserModel.create({
    id,
    email: `${id}@example.com`,
    passwordHash: 'unused',
    firstName: 'Test',
    lastName: 'User',
  });
  const company = await CompanyModel.create({ id: randomUUID(), userId: id, name: 'Example' });
  const application = await JobApplicationModel.create({
    id: randomUUID(),
    userId: id,
    companyId: company.id,
    jobTitle: 'Engineer',
  });
  const resume = await ResumeModel.create({
    id: randomUUID(),
    userId: id,
    title: 'Resume',
    originalFilename: 'Resume.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 100,
    storageKey: randomUUID(),
    extractedText: 'Private resume content with JS',
  });
  return { company, application, resume, auth: `Bearer ${signAccessToken({ id, role: 'user' })}` };
}

describe('application resume comparison API', () => {
  beforeAll(async () => {
    await createMigrator().up();
  });

  beforeEach(async () => {
    await sequelize.query(
      'TRUNCATE TABLE job_applications, resumes, companies, users RESTART IDENTITY CASCADE;',
    );
  });

  it('creates, updates, reads, preserves, and clears the optional description', async () => {
    const { auth, company } = await owner();
    const created = await request(app)
      .post(base)
      .set('Authorization', auth)
      .send({ companyId: company.id, jobTitle: 'Engineer', jobDescription: '  JavaScript  ' })
      .expect(201);
    const data = (created.body as ApiResponse<{ application: JobApplicationDto }>).data;
    if (!data) throw new Error('Expected application');
    expect(data.application.jobDescription).toBe('JavaScript');
    const path = `${base}/${data.application.id}`;
    for (const [body, description] of [
      [{ jobDescription: '  TS  ' }, 'TS'],
      [{ jobTitle: 'Senior Engineer' }, 'TS'],
      [{ jobDescription: '  ' }, null],
      [{ jobDescription: null }, null],
    ] as const) {
      await request(app).patch(path).set('Authorization', auth).send(body).expect(200);
      const response = await request(app).get(path).set('Authorization', auth).expect(200);
      expect(
        (response.body as ApiResponse<{ application: JobApplicationDto }>).data?.application
          .jobDescription,
      ).toBe(description);
    }
    await request(app)
      .patch(path)
      .set('Authorization', auth)
      .send({ jobDescription: 'x'.repeat(50_001) })
      .expect(400);
    await request(app)
      .patch(path)
      .set('Authorization', auth)
      .send({ jobDescription: 'a\0b' })
      .expect(400);
  });

  it('returns a deterministic comparison without exposing private text or keys', async () => {
    const { auth, application, resume } = await owner();
    await application.update({ jobDescription: 'JavaScript and TS required' });
    const response = await request(app)
      .post(`${base}/${application.id}/resume-match`)
      .set('Authorization', auth)
      .send({ resumeId: resume.id })
      .expect(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        match: {
          applicationId: application.id,
          resumeId: resume.id,
          status: 'compared',
          matchedSkills: ['JavaScript'],
          missingSkills: ['TypeScript'],
          matchedCount: 1,
          requiredCount: 2,
          coveragePercentage: 50,
        },
      },
      error: null,
      meta: {},
    });
  });

  it('enforces authentication, valid IDs, ownership, and paranoid deletion on both sides', async () => {
    const mine = await owner();
    const other = await owner();
    const path = `${base}/${mine.application.id}/resume-match`;
    await request(app).post(path).send({ resumeId: mine.resume.id }).expect(401);
    await request(app)
      .post(path)
      .set('Authorization', mine.auth)
      .send({ resumeId: 'invalid' })
      .expect(400);
    await request(app)
      .post(path)
      .set('Authorization', mine.auth)
      .send({ resumeId: other.resume.id })
      .expect(404);
    await request(app)
      .post(path)
      .set('Authorization', other.auth)
      .send({ resumeId: other.resume.id })
      .expect(404);
    await mine.resume.destroy();
    await request(app)
      .post(path)
      .set('Authorization', mine.auth)
      .send({ resumeId: mine.resume.id })
      .expect(404);
    await mine.company.destroy();
    const hidden = await request(app)
      .post(path)
      .set('Authorization', mine.auth)
      .send({ resumeId: mine.resume.id })
      .expect(404);
    expect((hidden.body as ApiResponse<never>).error?.code).toBe('APPLICATION_NOT_FOUND');
    await mine.company.restore();
    await mine.application.destroy();
    const deleted = await request(app)
      .post(path)
      .set('Authorization', mine.auth)
      .send({ resumeId: mine.resume.id })
      .expect(404);
    expect((deleted.body as ApiResponse<never>).error?.code).toBe('APPLICATION_NOT_FOUND');
  });

  it('reports missing source text and empty vocabulary results explicitly', async () => {
    const { auth, application, resume } = await owner();
    const compare = (status: number) =>
      request(app)
        .post(`${base}/${application.id}/resume-match`)
        .set('Authorization', auth)
        .send({ resumeId: resume.id })
        .expect(status);
    expect(((await compare(422)).body as ApiResponse<never>).error?.code).toBe(
      'JOB_DESCRIPTION_REQUIRED',
    );
    await application.update({ jobDescription: 'Teamwork' });
    expect((await compare(200)).body).toMatchObject({
      data: { match: { status: 'no_recognized_requirements', coveragePercentage: null } },
    });
    await application.update({ jobDescription: 'JavaScript' });
    await resume.update({ extractedText: null });
    expect(((await compare(422)).body as ApiResponse<never>).error?.code).toBe(
      'RESUME_TEXT_UNAVAILABLE',
    );
    await resume.update({ extractedText: 'Teamwork' });
    expect((await compare(200)).body).toMatchObject({
      data: { match: { status: 'no_recognized_resume_skills', coveragePercentage: 0 } },
    });
  });
});
