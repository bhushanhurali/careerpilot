import crypto from 'node:crypto';

import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../app.js';
import { createMigrator } from '../../db/migrator.js';
import { CompanyModel } from '../../db/models/company.model.js';
import { InterviewModel } from '../../db/models/interview.model.js';
import { JobApplicationModel } from '../../db/models/job-application.model.js';
import { UserModel } from '../../db/models/user.model.js';
import { sequelize } from '../../db/sequelize.js';
import { ApiResponse } from '../../shared/responses/api-response.js';
import { signAccessToken } from '../../shared/security/jwt.js';
import { InterviewDto } from './interviews.types.js';

const app = createApp();
const interviewInput = {
  type: 'technical',
  status: 'scheduled',
  scheduledAt: '2026-12-03T11:00:00+01:00',
};

function interviewsPath(applicationId: string): string {
  return `/api/v1/applications/${applicationId}/interviews`;
}

async function createTestUser(email: string) {
  const user = await UserModel.create({
    id: crypto.randomUUID(),
    email,
    passwordHash: 'test-password-hash',
    firstName: 'Test',
    lastName: 'User',
  });

  return {
    id: user.id,
    authorization: `Bearer ${signAccessToken({ id: user.id, role: 'user' })}`,
  };
}

async function createApplication(userId: string) {
  const company = await CompanyModel.create({
    id: crypto.randomUUID(),
    userId,
    name: `Company ${crypto.randomUUID()}`,
  });
  const application = await JobApplicationModel.create({
    id: crypto.randomUUID(),
    userId,
    companyId: company.id,
    jobTitle: 'Backend Developer',
  });

  return { application, company, path: interviewsPath(application.id) };
}

async function createInterview(applicationId: string) {
  return InterviewModel.create({
    id: crypto.randomUUID(),
    applicationId,
    type: 'technical',
    status: 'scheduled',
    scheduledAt: new Date(interviewInput.scheduledAt),
  });
}

describe('Interview API', () => {
  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL;
    const databaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';

    if (process.env.NODE_ENV !== 'test' || !databaseName.toLowerCase().includes('test')) {
      throw new Error('Interview integration tests must run against a test database');
    }

    await createMigrator().up();
  });

  beforeEach(async () => {
    await sequelize.query(
      'TRUNCATE TABLE interviews, application_status_history, job_applications, companies, refresh_tokens, users RESTART IDENTITY CASCADE;',
    );
  });

  it('requires authentication for every interview route', async () => {
    const path = interviewsPath(crypto.randomUUID());
    const detailPath = `${path}/${crypto.randomUUID()}`;

    await request(app).get(path).expect(401);
    await request(app).post(path).send(interviewInput).expect(401);
    await request(app).patch(detailPath).send({ status: 'completed' }).expect(401);
    await request(app).delete(detailPath).expect(401);
  });

  it('lists an empty collection, then lists only its interviews by scheduled time', async () => {
    const owner = await createTestUser('owner@example.com');
    const { application, path } = await createApplication(owner.id);
    const other = await createApplication(owner.id);
    await createInterview(other.application.id);

    const empty = await request(app)
      .get(path)
      .set('Authorization', owner.authorization)
      .expect(200);
    expect((empty.body as ApiResponse<{ interviews: InterviewDto[] }>).data).toEqual({
      interviews: [],
    });

    const later = await request(app)
      .post(path)
      .set('Authorization', owner.authorization)
      .send(interviewInput)
      .expect(201);
    const earlier = await request(app)
      .post(path)
      .set('Authorization', owner.authorization)
      .send({
        ...interviewInput,
        scheduledAt: '2026-12-02T09:00:00Z',
        durationMinutes: 45,
        location: '  Berlin  ',
        meetingUrl: '  https://meet.example/interview  ',
      })
      .expect(201);

    const created = earlier.body as ApiResponse<{ interview: InterviewDto }>;
    expect(created.data?.interview).toMatchObject({
      applicationId: application.id,
      type: 'technical',
      status: 'scheduled',
      scheduledAt: '2026-12-02T09:00:00.000Z',
      durationMinutes: 45,
      location: 'Berlin',
      meetingUrl: 'https://meet.example/interview',
      notes: null,
    });

    const list = await request(app).get(path).set('Authorization', owner.authorization).expect(200);
    const { data } = list.body as ApiResponse<{ interviews: InterviewDto[] }>;
    const laterInterview = (later.body as ApiResponse<{ interview: InterviewDto }>).data?.interview;
    expect(data?.interviews).toEqual([created.data?.interview, laterInterview]);
    expect(data?.interviews[1]?.scheduledAt).toBe('2026-12-03T10:00:00.000Z');
  });

  it('updates supplied fields, clears nullable fields, and soft-deletes the interview', async () => {
    const owner = await createTestUser('owner@example.com');
    const { application, path } = await createApplication(owner.id);
    const interview = await createInterview(application.id);
    await interview.update({ location: 'Berlin', durationMinutes: 45 });
    const detailPath = `${path}/${interview.id}`;

    const updated = await request(app)
      .patch(detailPath)
      .set('Authorization', owner.authorization)
      .send({
        status: 'rescheduled',
        scheduledAt: '2026-12-05T15:00:00Z',
        location: ' ',
        durationMinutes: null,
        notes: '  New slot  ',
      })
      .expect(200);
    expect(
      (updated.body as ApiResponse<{ interview: InterviewDto }>).data?.interview,
    ).toMatchObject({
      id: interview.id,
      type: 'technical',
      status: 'rescheduled',
      scheduledAt: '2026-12-05T15:00:00.000Z',
      location: null,
      durationMinutes: null,
      notes: 'New slot',
    });

    const removed = await request(app)
      .delete(detailPath)
      .set('Authorization', owner.authorization)
      .expect(200);
    expect((removed.body as ApiResponse<{ deleted: boolean }>).data).toEqual({ deleted: true });
    expect(await InterviewModel.findByPk(interview.id)).toBeNull();
    expect(
      (await InterviewModel.findByPk(interview.id, { paranoid: false }))?.deletedAt,
    ).toBeInstanceOf(Date);
    const list = await request(app).get(path).set('Authorization', owner.authorization).expect(200);
    expect((list.body as ApiResponse<{ interviews: InterviewDto[] }>).data).toEqual({
      interviews: [],
    });
    await request(app)
      .patch(detailPath)
      .set('Authorization', owner.authorization)
      .send({ status: 'completed' })
      .expect(404);
    await request(app).delete(detailPath).set('Authorization', owner.authorization).expect(404);
  });

  it('rejects cross-user requests and interview IDs outside the selected application', async () => {
    const owner = await createTestUser('owner@example.com');
    const stranger = await createTestUser('stranger@example.com');
    const { application, path } = await createApplication(owner.id);
    const other = await createApplication(owner.id);
    const interview = await createInterview(application.id);
    const detailPath = `${path}/${interview.id}`;

    await request(app).get(path).set('Authorization', stranger.authorization).expect(404);
    await request(app)
      .post(path)
      .set('Authorization', stranger.authorization)
      .send(interviewInput)
      .expect(404);
    await request(app)
      .patch(detailPath)
      .set('Authorization', stranger.authorization)
      .send({ status: 'completed' })
      .expect(404);
    await request(app).delete(detailPath).set('Authorization', stranger.authorization).expect(404);

    const wrongParentPath = `${other.path}/${interview.id}`;
    const wrongParent = await request(app)
      .patch(wrongParentPath)
      .set('Authorization', owner.authorization)
      .send({ status: 'completed' })
      .expect(404);
    expect((wrongParent.body as ApiResponse<never>).error?.code).toBe('INTERVIEW_NOT_FOUND');
    await request(app)
      .delete(wrongParentPath)
      .set('Authorization', owner.authorization)
      .expect(404);
    expect((await interview.reload()).status).toBe('scheduled');
    expect(await InterviewModel.count()).toBe(1);
  });

  it('hides missing and soft-deleted applications and applications under a deleted company', async () => {
    const owner = await createTestUser('owner@example.com');
    const { application, path } = await createApplication(owner.id);
    const underDeletedCompany = await createApplication(owner.id);
    const interview = await createInterview(application.id);
    await application.destroy();
    await underDeletedCompany.company.destroy();

    for (const hiddenPath of [
      interviewsPath(crypto.randomUUID()),
      path,
      underDeletedCompany.path,
    ]) {
      const response = await request(app)
        .get(hiddenPath)
        .set('Authorization', owner.authorization)
        .expect(404);
      expect((response.body as ApiResponse<never>).error?.code).toBe('APPLICATION_NOT_FOUND');
      await request(app)
        .post(hiddenPath)
        .set('Authorization', owner.authorization)
        .send(interviewInput)
        .expect(404);
    }

    const detailPath = `${path}/${interview.id}`;
    await request(app)
      .patch(detailPath)
      .set('Authorization', owner.authorization)
      .send({ status: 'completed' })
      .expect(404);
    await request(app).delete(detailPath).set('Authorization', owner.authorization).expect(404);
    expect((await interview.reload()).status).toBe('scheduled');
  });

  it('validates required fields, enums, timestamps, duration, URLs, IDs, and PATCH fields', async () => {
    const owner = await createTestUser('owner@example.com');
    const { application, path } = await createApplication(owner.id);
    const interview = await createInterview(application.id);
    const detailPath = `${path}/${interview.id}`;
    const invalidCreateBodies = [
      { type: 'technical', status: 'scheduled' },
      { ...interviewInput, type: 'panel' },
      { ...interviewInput, status: 'pending' },
      { ...interviewInput, scheduledAt: '2026-12-03T11:00:00' },
      { ...interviewInput, scheduledAt: '2026-12-03T11:00:00+99:99' },
      { ...interviewInput, durationMinutes: 0 },
      { ...interviewInput, durationMinutes: 1.5 },
      { ...interviewInput, meetingUrl: 'javascript:alert(1)' },
    ];

    for (const body of invalidCreateBodies) {
      const response = await request(app)
        .post(path)
        .set('Authorization', owner.authorization)
        .send(body)
        .expect(400);
      expect((response.body as ApiResponse<never>).error?.code).toBe('VALIDATION_ERROR');
    }

    for (const body of [
      {},
      { status: 'pending' },
      { applicationId: crypto.randomUUID() },
      { userId: owner.id },
    ]) {
      await request(app)
        .patch(detailPath)
        .set('Authorization', owner.authorization)
        .send(body)
        .expect(400);
    }
    await request(app)
      .get(interviewsPath('invalid'))
      .set('Authorization', owner.authorization)
      .expect(400);
    await request(app)
      .delete(`${path}/invalid`)
      .set('Authorization', owner.authorization)
      .expect(400);
    expect(await InterviewModel.count()).toBe(1);
  });
});
