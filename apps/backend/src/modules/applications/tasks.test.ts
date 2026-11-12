import crypto from 'node:crypto';

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createMigrator } from '../../db/migrator.js';
import { CompanyModel } from '../../db/models/company.model.js';
import { JobApplicationModel } from '../../db/models/job-application.model.js';
import { TaskModel } from '../../db/models/task.model.js';
import { UserModel } from '../../db/models/user.model.js';
import { sequelize } from '../../db/sequelize.js';

async function createApplication(): Promise<JobApplicationModel> {
  const user = await UserModel.create({
    id: crypto.randomUUID(),
    email: `${crypto.randomUUID()}@example.com`,
    passwordHash: 'test-password-hash',
    firstName: 'Test',
    lastName: 'User',
  });
  const company = await CompanyModel.create({
    id: crypto.randomUUID(),
    userId: user.id,
    name: 'Example Company',
  });

  return JobApplicationModel.create({
    id: crypto.randomUUID(),
    userId: user.id,
    companyId: company.id,
    jobTitle: 'Backend Developer',
  });
}

async function createTask(applicationId: string): Promise<TaskModel> {
  return TaskModel.create({
    id: crypto.randomUUID(),
    applicationId,
    title: '  Follow up with recruiter  ',
    notes: '   ',
    dueOn: '2026-11-12',
  });
}

describe('task database foundation', () => {
  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL;
    const databaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';

    if (process.env.NODE_ENV !== 'test' || !databaseName.toLowerCase().includes('test')) {
      throw new Error('Task database foundation tests must run against a test database');
    }

    await createMigrator().up();
  });

  beforeEach(async () => {
    await sequelize.query(
      'TRUNCATE TABLE tasks, job_applications, companies, users RESTART IDENTITY CASCADE;',
    );
  });

  it('loads both associations and preserves a date-only due date and nullable fields', async () => {
    const application = await createApplication();
    const task = await createTask(application.id);
    const undated = await TaskModel.create({
      id: crypto.randomUUID(),
      applicationId: application.id,
      title: 'Check application status',
    });

    await task.reload({ include: ['application'] });
    await undated.reload();
    await application.reload({ include: ['tasks'] });

    expect(task.get('application')).toMatchObject({ id: application.id });
    expect(application.get('tasks')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: task.id }),
        expect.objectContaining({ id: undated.id }),
      ]),
    );
    expect(task).toMatchObject({
      title: 'Follow up with recruiter',
      notes: null,
      dueOn: '2026-11-12',
      priority: 'medium',
      completedAt: null,
    });
    expect(undated.dueOn).toBeNull();
  });

  it('keeps tasks after parent soft deletion and cascades a physical delete', async () => {
    const application = await createApplication();
    const task = await createTask(application.id);
    const deletedTask = await createTask(application.id);
    await deletedTask.destroy();

    await application.destroy();
    expect(await TaskModel.findByPk(task.id)).not.toBeNull();
    expect(await TaskModel.findByPk(deletedTask.id)).toBeNull();
    expect(
      (await TaskModel.findByPk(deletedTask.id, { paranoid: false }))?.deletedAt,
    ).toBeInstanceOf(Date);

    await application.destroy({ force: true });
    expect(
      await TaskModel.count({ where: { applicationId: application.id }, paranoid: false }),
    ).toBe(0);
  });

  it('enforces the parent, title, priority and calendar-date constraints in PostgreSQL', async () => {
    const application = await createApplication();
    const insert = (values: Record<string, string | null>) =>
      sequelize.query(
        `INSERT INTO tasks (id, application_id, title, priority, due_on, created_at, updated_at)
         VALUES (:id, :applicationId, :title, :priority, :dueOn, now(), now());`,
        {
          replacements: {
            id: crypto.randomUUID(),
            applicationId: application.id,
            title: 'Follow up',
            priority: 'medium',
            dueOn: '2026-11-12',
            ...values,
          },
        },
      );

    for (const title of ['', ' \t ', '  Follow up', 'Follow up  ']) {
      await expect(insert({ title })).rejects.toMatchObject({
        parent: { constraint: 'tasks_title_trimmed_not_empty_check' },
      });
    }
    await expect(insert({ priority: 'urgent' })).rejects.toMatchObject({
      parent: { constraint: 'tasks_priority_check' },
    });
    await expect(insert({ applicationId: crypto.randomUUID() })).rejects.toMatchObject({
      parent: { code: '23503' },
    });
    await expect(insert({ applicationId: null })).rejects.toMatchObject({
      parent: { code: '23502' },
    });
    await expect(insert({ dueOn: '2026-02-30' })).rejects.toMatchObject({
      parent: { code: '22008' },
    });
  });
});
