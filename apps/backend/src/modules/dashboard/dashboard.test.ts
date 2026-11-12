import crypto from 'node:crypto';

import request from 'supertest';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../app.js';
import { createMigrator } from '../../db/migrator.js';
import { ApplicationStatusHistoryModel } from '../../db/models/application-status-history.model.js';
import { CompanyModel } from '../../db/models/company.model.js';
import { InterviewModel } from '../../db/models/interview.model.js';
import { JobApplicationModel } from '../../db/models/job-application.model.js';
import { TaskModel } from '../../db/models/task.model.js';
import { UserModel } from '../../db/models/user.model.js';
import { sequelize } from '../../db/sequelize.js';
import { ApiResponse } from '../../shared/responses/api-response.js';
import { signAccessToken } from '../../shared/security/jwt.js';
import { DashboardDto } from './dashboard.types.js';

const app = createApp();
const path = '/api/v1/dashboard';
const asOf = '2026-01-31T23:30:00.000Z';
const today = '2026-02-01';

async function createOwner() {
  const id = crypto.randomUUID();
  await UserModel.create({
    id,
    email: `${id}@example.com`,
    passwordHash: 'test-password-hash',
    firstName: 'Test',
    lastName: 'User',
  });
  return { id, authorization: `Bearer ${signAccessToken({ id, role: 'user' })}` };
}

async function createCompany(userId: string) {
  const id = crypto.randomUUID();
  return CompanyModel.create({ id, userId, name: `Example Company ${id}` });
}

function createApplication(
  company: CompanyModel,
  values: Pick<Partial<JobApplicationModel>, 'status' | 'appliedAt' | 'updatedAt'> = {},
) {
  return JobApplicationModel.create(
    {
      id: crypto.randomUUID(),
      userId: company.userId,
      companyId: company.id,
      jobTitle: 'Backend Developer',
      ...values,
    },
    { silent: values.updatedAt !== undefined },
  );
}

function createInterview(
  applicationId: string,
  scheduledAt: string,
  status: InterviewModel['status'] = 'scheduled',
) {
  return InterviewModel.create({
    id: crypto.randomUUID(),
    applicationId,
    type: 'technical',
    status,
    scheduledAt: new Date(scheduledAt),
  });
}

function createTask(applicationId: string, dueOn: string | null, completedAt: Date | null = null) {
  return TaskModel.create({
    id: crypto.randomUUID(),
    applicationId,
    title: 'Follow up',
    dueOn,
    completedAt,
  });
}

function recordOffer(applicationId: string) {
  return ApplicationStatusHistoryModel.create({
    id: crypto.randomUUID(),
    applicationId,
    toStatus: 'offer',
    changedAt: new Date(),
  });
}

async function getDashboard(owner: Awaited<ReturnType<typeof createOwner>>, localToday?: string) {
  const result = await request(app)
    .get(path)
    .set('Authorization', owner.authorization)
    .query(localToday === undefined ? {} : { today: localToday })
    .expect(200);
  const response = result.body as ApiResponse<DashboardDto>;
  expect(response).toMatchObject({ success: true, error: null, meta: {} });
  if (!response.data) throw new Error('Expected dashboard data');
  return response.data;
}

describe('Dashboard API', () => {
  beforeAll(async () => {
    await createMigrator().up();
  });

  beforeEach(async () => {
    await sequelize.query(
      'TRUNCATE TABLE job_applications, companies, users RESTART IDENTITY CASCADE;',
    );
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(asOf));
  });

  afterEach(() => vi.useRealTimers());

  it('requires authentication and validates the optional calendar date', async () => {
    await request(app).get(path).expect(401);
    const owner = await createOwner();
    for (const query of [
      { today: '2026-02-30' },
      { today: '0001-05-31' },
      { today: '2026-02-01T00:00:00Z' },
      { userId: owner.id },
    ]) {
      const result = await request(app)
        .get(path)
        .set('Authorization', owner.authorization)
        .query(query)
        .expect(400);
      expect((result.body as ApiResponse<never>).error?.code).toBe('VALIDATION_ERROR');
    }
  });

  it('returns zero counts, six empty months, and empty lists for a new user', async () => {
    const data = await getDashboard(await createOwner());
    expect(data.asOf).toBe(asOf);
    expect(data.today).toBe('2026-01-31');
    expect(data.kpis).toEqual({
      activeApplications: 0,
      applicationsSubmittedThisMonth: 0,
      upcomingInterviews: 0,
      offersReceived: 0,
      overdueTasks: 0,
    });
    expect(data.statusDistribution.map(({ status }) => status)).toEqual([
      'draft',
      'applied',
      'screening',
      'interviewing',
      'offer',
      'rejected',
      'withdrawn',
      'accepted',
    ]);
    expect(data.statusDistribution.every(({ count }) => count === 0)).toBe(true);
    expect(data.submissionTrend).toEqual(
      ['2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01'].map((month) => ({
        month,
        count: 0,
      })),
    );
    expect(data.upcomingInterviews).toEqual([]);
    expect(data.overdueTasks).toEqual([]);
    expect(data.upcomingTasks).toEqual([]);
    expect(data.recentApplications).toEqual([]);
  });

  it('counts pipeline applications, distinct offers, and submissions by the supplied local date', async () => {
    const owner = await createOwner();
    const company = await createCompany(owner.id);
    await createApplication(company);
    await createApplication(company, { status: 'applied', appliedAt: '2025-08-31' });
    await createApplication(company, { status: 'withdrawn', appliedAt: '2025-09-01' });
    await createApplication(company, { status: 'rejected', appliedAt: '2026-01-31' });
    const accepted = await createApplication(company, { status: 'accepted', appliedAt: today });
    await createApplication(company, { status: 'applied', appliedAt: '2026-02-02' });
    const offer = await createApplication(company, { status: 'offer', appliedAt: today });
    await recordOffer(accepted.id);
    await recordOffer(accepted.id);
    await recordOffer(offer.id);

    const data = await getDashboard(owner, today);
    expect(data.today).toBe(today);
    expect(data.kpis).toMatchObject({
      activeApplications: 4,
      applicationsSubmittedThisMonth: 2,
      offersReceived: 2,
    });
    expect(data.statusDistribution).toContainEqual({ status: 'accepted', count: 1 });
    expect(data.statusDistribution).toContainEqual({ status: 'offer', count: 1 });
    expect(data.submissionTrend).toEqual([
      { month: '2025-09', count: 1 },
      { month: '2025-10', count: 0 },
      { month: '2025-11', count: 0 },
      { month: '2025-12', count: 0 },
      { month: '2026-01', count: 1 },
      { month: '2026-02', count: 2 },
    ]);
  });

  it('returns six valid year-month labels at the earliest accepted calendar date', async () => {
    const data = await getDashboard(await createOwner(), '0001-06-01');
    expect(data.submissionTrend).toEqual(
      ['0001-01', '0001-02', '0001-03', '0001-04', '0001-05', '0001-06'].map((month) => ({
        month,
        count: 0,
      })),
    );
  });

  it('excludes foreign ownership and deleted applications, companies, interviews, and tasks', async () => {
    const owner = await createOwner();
    const other = await createOwner();
    const company = await createCompany(owner.id);
    const hiddenCompany = await createCompany(owner.id);
    const visible = await createApplication(company, { status: 'applied', appliedAt: today });
    const hidden = await createApplication(hiddenCompany, { status: 'offer', appliedAt: today });
    const deleted = await createApplication(company, { status: 'offer', appliedAt: today });
    const foreignCompany = await createCompany(other.id);
    const foreign = await createApplication(foreignCompany, {
      status: 'offer',
      appliedAt: today,
    });
    const mismatched = await JobApplicationModel.create({
      id: crypto.randomUUID(),
      userId: owner.id,
      companyId: foreignCompany.id,
      jobTitle: 'Hidden application',
      status: 'offer',
      appliedAt: today,
    });
    for (const application of [hidden, deleted, foreign, mismatched]) {
      await createInterview(application.id, asOf);
      await createTask(application.id, '2026-01-31');
      await createTask(application.id, today);
      await recordOffer(application.id);
    }
    await hiddenCompany.destroy();
    await deleted.destroy();
    await (await createInterview(visible.id, asOf)).destroy();
    await (await createTask(visible.id, '2026-01-31')).destroy();
    await (await createTask(visible.id, today)).destroy();

    const data = await getDashboard(owner, today);
    expect(data.kpis).toEqual({
      activeApplications: 1,
      applicationsSubmittedThisMonth: 1,
      upcomingInterviews: 0,
      offersReceived: 0,
      overdueTasks: 0,
    });
    expect(data.statusDistribution.filter(({ count }) => count > 0)).toEqual([
      { status: 'applied', count: 1 },
    ]);
    expect(data.submissionTrend.at(-1)?.count).toBe(1);
    expect(data.upcomingInterviews).toEqual([]);
    expect(data.overdueTasks).toEqual([]);
    expect(data.upcomingTasks).toEqual([]);
    expect(data.recentApplications.map(({ id }) => id)).toEqual([visible.id]);
  });

  it('counts eligible interviews and overdue tasks independently of ordered preview limits', async () => {
    const owner = await createOwner();
    const company = await createCompany(owner.id);
    const application = await createApplication(company, {
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    });
    const firstInterview = await createInterview(application.id, asOf);
    await createInterview(application.id, '2026-01-31T23:29:59.999Z');
    await createInterview(application.id, '2026-02-01T00:00:00Z', 'cancelled');
    await createInterview(application.id, '2026-02-01T00:00:00Z', 'rescheduled');
    const overdue = [];
    const upcoming = [];
    const recent = [];
    for (let day = 1; day <= 6; day++) {
      const date = `2026-02-0${String(day)}`;
      await createInterview(application.id, `${date}T12:00:00Z`);
      overdue.push(await createTask(application.id, `2026-01-2${String(day)}`));
      upcoming.push(await createTask(application.id, date));
      recent.push(
        await createApplication(company, {
          updatedAt: new Date(`2026-01-0${String(day + 1)}T00:00:00Z`),
        }),
      );
    }
    await createTask(application.id, '2026-02-07');
    await createTask(application.id, '2026-02-08');
    await createTask(application.id, null);
    await createTask(application.id, '2026-01-01', new Date());
    await createTask(application.id, today, new Date());

    const data = await getDashboard(owner, today);
    expect(data.kpis).toMatchObject({ upcomingInterviews: 7, overdueTasks: 6 });
    expect(data.upcomingInterviews).toHaveLength(5);
    expect(data.upcomingInterviews[0]).toMatchObject({
      id: firstInterview.id,
      applicationId: application.id,
      scheduledAt: asOf,
      companyName: company.name,
    });
    expect(data.upcomingInterviews.at(-1)?.scheduledAt).toBe('2026-02-04T12:00:00.000Z');
    expect(data.overdueTasks.map(({ id }) => id)).toEqual(overdue.slice(0, 5).map(({ id }) => id));
    expect(data.upcomingTasks.map(({ id }) => id)).toEqual(
      upcoming.slice(0, 5).map(({ id }) => id),
    );
    expect(data.upcomingTasks[0]?.dueOn).toBe(today);
    expect(data.recentApplications.map(({ id }) => id)).toEqual(
      recent
        .reverse()
        .slice(0, 5)
        .map(({ id }) => id),
    );
  });

  it('includes the seventh calendar day but excludes the eighth from upcoming tasks', async () => {
    const owner = await createOwner();
    const application = await createApplication(await createCompany(owner.id));
    const seventh = await createTask(application.id, '2026-02-07');
    await createTask(application.id, '2026-02-08');
    expect((await getDashboard(owner, today)).upcomingTasks.map(({ id }) => id)).toEqual([
      seventh.id,
    ]);
  });
});
