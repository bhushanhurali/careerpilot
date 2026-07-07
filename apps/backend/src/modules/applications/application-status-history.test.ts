import crypto from 'node:crypto';

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createMigrator } from '../../db/migrator.js';
import { ApplicationStatusHistoryModel } from '../../db/models/application-status-history.model.js';
import { CompanyModel } from '../../db/models/company.model.js';
import { JobApplicationModel } from '../../db/models/job-application.model.js';
import { UserModel } from '../../db/models/user.model.js';
import { sequelize } from '../../db/sequelize.js';

function assertTestDatabase(): void {
  const databaseUrl = process.env.DATABASE_URL;
  const databaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';

  if (process.env.NODE_ENV !== 'test' || !databaseName.toLowerCase().includes('test')) {
    throw new Error('Application status history tests must run against a test database');
  }
}

async function truncateBusinessTables(): Promise<void> {
  await sequelize.query(
    'TRUNCATE TABLE application_status_history, job_applications, companies, refresh_tokens, users RESTART IDENTITY CASCADE;',
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
    status: 'applied',
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

describe('application status history database foundation', () => {
  beforeAll(async () => {
    assertTestDatabase();
    await createMigrator().up();
  });

  beforeEach(async () => {
    await truncateBusinessTables();
  });

  it('associates status history entries with a job application', async () => {
    const user = await createUser();
    const company = await createCompany(user.id);
    const application = await createApplication(user.id, company.id);
    const changedAt = new Date('2026-07-07T09:00:00.000Z');

    await ApplicationStatusHistoryModel.create({
      id: crypto.randomUUID(),
      applicationId: application.id,
      fromStatus: null,
      toStatus: 'applied',
      changedAt,
      note: '  Initial application state  ',
    });

    const applicationWithHistory = await JobApplicationModel.findByPk(application.id, {
      include: [{ model: ApplicationStatusHistoryModel, as: 'statusHistory' }],
    });
    const statusHistory = applicationWithHistory?.get(
      'statusHistory',
    ) as ApplicationStatusHistoryModel[];

    expect(statusHistory).toHaveLength(1);
    expect(statusHistory[0]?.applicationId).toBe(application.id);
    expect(statusHistory[0]?.fromStatus).toBeNull();
    expect(statusHistory[0]?.toStatus).toBe('applied');
    expect(statusHistory[0]?.changedAt.toISOString()).toBe(changedAt.toISOString());
    expect(statusHistory[0]?.note).toBe('Initial application state');
  });

  it('retains history when an application is soft-deleted', async () => {
    const user = await createUser();
    const company = await createCompany(user.id);
    const application = await createApplication(user.id, company.id);

    await ApplicationStatusHistoryModel.create({
      id: crypto.randomUUID(),
      applicationId: application.id,
      fromStatus: null,
      toStatus: 'applied',
      changedAt: application.createdAt,
      note: null,
    });

    await application.destroy();

    const retainedHistoryCount = await ApplicationStatusHistoryModel.count({
      where: { applicationId: application.id },
    });

    expect(retainedHistoryCount).toBe(1);
  });

  it('backfills initial history for existing active and soft-deleted applications', async () => {
    const user = await createUser();
    const company = await createCompany(user.id);
    const activeApplication = await createApplication(user.id, company.id);
    const softDeletedApplication = await createApplication(user.id, company.id);
    const migrator = createMigrator();

    await softDeletedApplication.destroy();
    await migrator.down();

    try {
      await migrator.up();

      const historyEntries = await ApplicationStatusHistoryModel.findAll({
        order: [['applicationId', 'ASC']],
      });

      expect(historyEntries).toHaveLength(2);
      expect(historyEntries.map((entry) => entry.applicationId).sort()).toEqual(
        [activeApplication.id, softDeletedApplication.id].sort(),
      );

      for (const entry of historyEntries) {
        const sourceApplication =
          entry.applicationId === activeApplication.id ? activeApplication : softDeletedApplication;

        expect(entry.fromStatus).toBeNull();
        expect(entry.toStatus).toBe(sourceApplication.status);
        expect(entry.changedAt.toISOString()).toBe(sourceApplication.createdAt.toISOString());
      }
    } finally {
      await migrator.up();
    }
  });

  it('physically cascades history when an application is hard-deleted', async () => {
    const user = await createUser();
    const company = await createCompany(user.id);
    const application = await createApplication(user.id, company.id);

    await ApplicationStatusHistoryModel.create({
      id: crypto.randomUUID(),
      applicationId: application.id,
      fromStatus: null,
      toStatus: 'applied',
      changedAt: application.createdAt,
      note: null,
    });

    await application.destroy({ force: true });

    const cascadedHistoryCount = await ApplicationStatusHistoryModel.count({
      where: { applicationId: application.id },
    });

    expect(cascadedHistoryCount).toBe(0);
  });
});
