import crypto from 'node:crypto';

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createMigrator } from '../../db/migrator.js';
import { CompanyModel } from '../../db/models/company.model.js';
import { InterviewModel } from '../../db/models/interview.model.js';
import { JobApplicationModel } from '../../db/models/job-application.model.js';
import { UserModel } from '../../db/models/user.model.js';
import { sequelize } from '../../db/sequelize.js';

function assertTestDatabase(): void {
  const databaseUrl = process.env.DATABASE_URL;
  const databaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';

  if (process.env.NODE_ENV !== 'test' || !databaseName.toLowerCase().includes('test')) {
    throw new Error('Interview database foundation tests must run against a test database');
  }
}

async function truncateBusinessTables(): Promise<void> {
  await sequelize.query(
    'TRUNCATE TABLE interviews, application_status_history, job_applications, companies, refresh_tokens, users RESTART IDENTITY CASCADE;',
  );
}

async function createUser(): Promise<UserModel> {
  return UserModel.create({
    id: crypto.randomUUID(),
    email: `${crypto.randomUUID()}@example.com`,
    passwordHash: 'test-password-hash',
    firstName: 'Test',
    lastName: 'User',
  });
}

async function createCompany(userId: string): Promise<CompanyModel> {
  return CompanyModel.create({
    id: crypto.randomUUID(),
    userId,
    name: `Company ${crypto.randomUUID()}`,
    website: null,
    industry: null,
    location: null,
    notes: null,
  });
}

async function createApplication(userId: string, companyId: string): Promise<JobApplicationModel> {
  return JobApplicationModel.create({
    id: crypto.randomUUID(),
    userId,
    companyId,
    contactId: null,
    jobTitle: 'Angular Developer',
    jobUrl: null,
    source: null,
    status: 'interviewing',
    priority: 'medium',
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    location: null,
    employmentType: null,
    workMode: null,
    appliedAt: null,
    notes: null,
  });
}

async function createInterview(applicationId: string): Promise<InterviewModel> {
  return InterviewModel.create({
    id: crypto.randomUUID(),
    applicationId,
    type: 'technical',
    status: 'scheduled',
    scheduledAt: new Date('2026-08-31T09:00:00.000Z'),
    durationMinutes: 60,
    location: '  Berlin office  ',
    meetingUrl: '  https://meet.example/interview  ',
    notes: '  Bring portfolio examples  ',
  });
}

describe('interview database foundation', () => {
  beforeAll(async () => {
    assertTestDatabase();
    await createMigrator().up();
  });

  beforeEach(async () => {
    await truncateBusinessTables();
  });

  it('associates interviews with a job application and normalizes optional text', async () => {
    const user = await createUser();
    const company = await createCompany(user.id);
    const application = await createApplication(user.id, company.id);

    const interview = await createInterview(application.id);

    const applicationWithInterviews = await JobApplicationModel.findByPk(application.id, {
      include: [{ model: InterviewModel, as: 'interviews' }],
    });
    const interviews = applicationWithInterviews?.get('interviews') as InterviewModel[];

    expect(interviews).toHaveLength(1);
    expect(interviews[0]?.id).toBe(interview.id);
    expect(interviews[0]?.applicationId).toBe(application.id);
    expect(interviews[0]?.type).toBe('technical');
    expect(interviews[0]?.status).toBe('scheduled');
    expect(interviews[0]?.durationMinutes).toBe(60);
    expect(interviews[0]?.location).toBe('Berlin office');
    expect(interviews[0]?.meetingUrl).toBe('https://meet.example/interview');
    expect(interviews[0]?.notes).toBe('Bring portfolio examples');
  });

  it('retains interviews when an application is soft-deleted', async () => {
    const user = await createUser();
    const company = await createCompany(user.id);
    const application = await createApplication(user.id, company.id);

    await createInterview(application.id);
    await application.destroy();

    const retainedInterviewCount = await InterviewModel.count({
      where: { applicationId: application.id },
    });

    expect(retainedInterviewCount).toBe(1);
  });

  it('physically cascades interviews when an application is hard-deleted', async () => {
    const user = await createUser();
    const company = await createCompany(user.id);
    const application = await createApplication(user.id, company.id);

    await createInterview(application.id);
    await application.destroy({ force: true });

    const cascadedInterviewCount = await InterviewModel.count({
      where: { applicationId: application.id },
    });

    expect(cascadedInterviewCount).toBe(0);
  });

  it('soft-deletes interviews', async () => {
    const user = await createUser();
    const company = await createCompany(user.id);
    const application = await createApplication(user.id, company.id);
    const interview = await createInterview(application.id);

    await interview.destroy();

    const defaultLookup = await InterviewModel.findByPk(interview.id);
    const paranoidLookup = await InterviewModel.findByPk(interview.id, { paranoid: false });

    expect(defaultLookup).toBeNull();
    expect(paranoidLookup?.deletedAt).toBeInstanceOf(Date);
  });

  it('enforces type, status, scheduled time, duration, and parent constraints', async () => {
    const user = await createUser();
    const company = await createCompany(user.id);
    const application = await createApplication(user.id, company.id);
    const now = new Date();

    await expect(
      sequelize.query(
        `INSERT INTO interviews
          (id, application_id, type, status, scheduled_at, duration_minutes, created_at, updated_at)
         VALUES
          (:id, :applicationId, 'panel', 'scheduled', :scheduledAt, 30, :createdAt, :updatedAt);`,
        {
          replacements: {
            id: crypto.randomUUID(),
            applicationId: application.id,
            scheduledAt: now,
            createdAt: now,
            updatedAt: now,
          },
        },
      ),
    ).rejects.toThrow();

    await expect(
      sequelize.query(
        `INSERT INTO interviews
          (id, application_id, type, status, scheduled_at, duration_minutes, created_at, updated_at)
         VALUES
          (:id, :applicationId, 'technical', 'pending', :scheduledAt, 30, :createdAt, :updatedAt);`,
        {
          replacements: {
            id: crypto.randomUUID(),
            applicationId: application.id,
            scheduledAt: now,
            createdAt: now,
            updatedAt: now,
          },
        },
      ),
    ).rejects.toThrow();

    await expect(
      sequelize.query(
        `INSERT INTO interviews
          (id, application_id, type, status, scheduled_at, duration_minutes, created_at, updated_at)
         VALUES
          (:id, :applicationId, 'technical', 'scheduled', :scheduledAt, 0, :createdAt, :updatedAt);`,
        {
          replacements: {
            id: crypto.randomUUID(),
            applicationId: application.id,
            scheduledAt: now,
            createdAt: now,
            updatedAt: now,
          },
        },
      ),
    ).rejects.toThrow();

    await expect(
      sequelize.query(
        `INSERT INTO interviews
          (id, application_id, type, status, duration_minutes, created_at, updated_at)
         VALUES
          (:id, :applicationId, 'technical', 'scheduled', 30, :createdAt, :updatedAt);`,
        {
          replacements: {
            id: crypto.randomUUID(),
            applicationId: application.id,
            createdAt: now,
            updatedAt: now,
          },
        },
      ),
    ).rejects.toThrow();

    await expect(
      InterviewModel.create({
        id: crypto.randomUUID(),
        applicationId: crypto.randomUUID(),
        type: 'technical',
        status: 'scheduled',
        scheduledAt: now,
        durationMinutes: 30,
        location: null,
        meetingUrl: null,
        notes: null,
      }),
    ).rejects.toThrow();
  });
});
