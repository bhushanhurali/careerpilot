import crypto from 'node:crypto';

import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../app.js';
import { createMigrator } from '../../db/migrator.js';
import { CompanyModel } from '../../db/models/company.model.js';
import { JobApplicationModel } from '../../db/models/job-application.model.js';
import { TaskModel } from '../../db/models/task.model.js';
import { UserModel } from '../../db/models/user.model.js';
import { sequelize } from '../../db/sequelize.js';
import { ApiResponse } from '../../shared/responses/api-response.js';
import { signAccessToken } from '../../shared/security/jwt.js';
import { TaskDto, TaskListItemDto } from './tasks.types.js';

const app = createApp();
const tasksPath = '/api/v1/tasks';

function applicationTasksPath(applicationId: string): string {
  return `/api/v1/applications/${applicationId}/tasks`;
}

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
  return { application, company, path: applicationTasksPath(application.id) };
}

function createTask(applicationId: string, values: Partial<TaskModel> = {}) {
  return TaskModel.create({
    id: crypto.randomUUID(),
    applicationId,
    title: 'Follow up',
    ...values,
  });
}

describe('Tasks API', () => {
  beforeAll(async () => {
    await createMigrator().up();
  });

  beforeEach(async () => {
    await sequelize.query(
      'TRUNCATE TABLE tasks, job_applications, companies, users RESTART IDENTITY CASCADE;',
    );
  });

  it('requires authentication and does not expose top-level writes', async () => {
    const path = applicationTasksPath(crypto.randomUUID());
    const itemPath = `${path}/${crypto.randomUUID()}`;
    await request(app).get(tasksPath).expect(401);
    await request(app).get(path).expect(401);
    await request(app).post(path).send({ title: 'Follow up' }).expect(401);
    await request(app).get(itemPath).expect(401);
    await request(app).patch(itemPath).send({ completed: true }).expect(401);
    await request(app).delete(itemPath).expect(401);

    const owner = await createOwner();
    await request(app).post(tasksPath).set('Authorization', owner.authorization).expect(404);
    await request(app)
      .patch(`${tasksPath}/${crypto.randomUUID()}`)
      .set('Authorization', owner.authorization)
      .expect(404);
    await request(app)
      .delete(`${tasksPath}/${crypto.randomUUID()}`)
      .set('Authorization', owner.authorization)
      .expect(404);
  });

  it('creates, reads, edits, lists, and soft-deletes a task under its application', async () => {
    const owner = await createOwner();
    const { application, path } = await createApplication(owner.id);
    const other = await createApplication(owner.id);
    await createTask(other.application.id);

    const created = await request(app)
      .post(path)
      .set('Authorization', owner.authorization)
      .send({ title: '  Follow up  ', dueOn: '2028-02-29', notes: '  Call recruiter  ' })
      .expect(201);
    const task = (created.body as ApiResponse<{ task: TaskDto }>).data?.task;
    if (!task) throw new Error('Expected created task');
    expect(task).toMatchObject({
      applicationId: application.id,
      title: 'Follow up',
      dueOn: '2028-02-29',
      notes: 'Call recruiter',
      priority: 'medium',
      completedAt: null,
    });
    const itemPath = `${path}/${task.id}`;
    const read = await request(app)
      .get(itemPath)
      .set('Authorization', owner.authorization)
      .expect(200);
    expect((read.body as ApiResponse<{ task: TaskDto }>).data?.task).toEqual(task);

    const edited = await request(app)
      .patch(itemPath)
      .set('Authorization', owner.authorization)
      .send({ notes: ' ', dueOn: null, priority: 'high' })
      .expect(200);
    const editedTask = (edited.body as ApiResponse<{ task: TaskDto }>).data?.task;
    expect(editedTask).toMatchObject({
      title: 'Follow up',
      notes: null,
      dueOn: null,
      priority: 'high',
    });
    const list = await request(app).get(path).set('Authorization', owner.authorization).expect(200);
    expect((list.body as ApiResponse<{ tasks: TaskDto[] }>).data?.tasks).toEqual([editedTask]);

    await request(app).delete(itemPath).set('Authorization', owner.authorization).expect(200);
    expect(await TaskModel.findByPk(task.id)).toBeNull();
    expect((await TaskModel.findByPk(task.id, { paranoid: false }))?.deletedAt).toBeInstanceOf(
      Date,
    );
    const missing = await request(app)
      .get(itemPath)
      .set('Authorization', owner.authorization)
      .expect(404);
    expect((missing.body as ApiResponse<never>).error?.code).toBe('TASK_NOT_FOUND');
    await request(app)
      .patch(itemPath)
      .set('Authorization', owner.authorization)
      .send({ completed: true })
      .expect(404);
    await request(app).delete(itemPath).set('Authorization', owner.authorization).expect(404);
  });

  it('completes idempotently, preserves completion on edit, and reopens', async () => {
    const owner = await createOwner();
    const { application, path } = await createApplication(owner.id);
    const task = await createTask(application.id, { dueOn: '2026-11-10' });
    const patch = async (body: Record<string, unknown>) => {
      const response = await request(app)
        .patch(`${path}/${task.id}`)
        .set('Authorization', owner.authorization)
        .send(body)
        .expect(200);
      return (response.body as ApiResponse<{ task: TaskDto }>).data?.task;
    };
    const completed = await patch({ completed: true });
    expect(completed?.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
    expect((await patch({ completed: true }))?.completedAt).toBe(completed?.completedAt);
    expect((await patch({ title: 'Done' }))?.completedAt).toBe(completed?.completedAt);
    expect(await patch({ completed: false })).toMatchObject({
      completedAt: null,
      dueOn: '2026-11-10',
      title: 'Done',
    });
  });

  it('conceals cross-user, missing, deleted, and wrong-parent resources', async () => {
    const owner = await createOwner();
    const stranger = await createOwner();
    const { application, path } = await createApplication(owner.id);
    const another = await createApplication(owner.id);
    const hidden = await createApplication(owner.id);
    const task = await createTask(application.id);
    await hidden.company.destroy();

    const crossUser = await request(app)
      .get(path)
      .set('Authorization', stranger.authorization)
      .expect(404);
    expect((crossUser.body as ApiResponse<never>).error?.code).toBe('APPLICATION_NOT_FOUND');
    await request(app)
      .post(path)
      .set('Authorization', stranger.authorization)
      .send({ title: 'Blocked' })
      .expect(404);
    await request(app)
      .patch(`${path}/${task.id}`)
      .set('Authorization', stranger.authorization)
      .send({ completed: true })
      .expect(404);
    await request(app)
      .delete(`${path}/${task.id}`)
      .set('Authorization', stranger.authorization)
      .expect(404);
    const wrongParent = await request(app)
      .get(`${another.path}/${task.id}`)
      .set('Authorization', owner.authorization)
      .expect(404);
    expect((wrongParent.body as ApiResponse<never>).error?.code).toBe('TASK_NOT_FOUND');
    await request(app)
      .patch(`${another.path}/${task.id}`)
      .set('Authorization', owner.authorization)
      .send({ completed: true })
      .expect(404);
    await request(app)
      .delete(`${another.path}/${task.id}`)
      .set('Authorization', owner.authorization)
      .expect(404);

    await application.destroy();
    for (const hiddenPath of [path, hidden.path, applicationTasksPath(crypto.randomUUID())]) {
      const result = await request(app)
        .get(hiddenPath)
        .set('Authorization', owner.authorization)
        .expect(404);
      expect((result.body as ApiResponse<never>).error?.code).toBe('APPLICATION_NOT_FOUND');
      await request(app)
        .post(hiddenPath)
        .set('Authorization', owner.authorization)
        .send({ title: 'Blocked' })
        .expect(404);
    }
    expect((await task.reload()).completedAt).toBeNull();
  });

  it('validates task fields, identifiers, and listing queries', async () => {
    const owner = await createOwner();
    const { path } = await createApplication(owner.id);
    for (const body of [
      { title: '  ' },
      { title: 'Task', priority: 'urgent' },
      { title: 'Task', dueOn: '2026-02-29' },
      { title: 'Task', dueOn: '2026-11-11T00:00:00Z' },
      { title: 'Task', completed: true },
      { title: 'Task\0' },
      { title: 'Task', notes: 'Note\0' },
    ]) {
      const result = await request(app)
        .post(path)
        .set('Authorization', owner.authorization)
        .send(body)
        .expect(400);
      expect((result.body as ApiResponse<never>).error?.code).toBe('VALIDATION_ERROR');
    }
    for (const body of [
      {},
      { completed: 'true' },
      { completedAt: null },
      { applicationId: crypto.randomUUID() },
      { userId: owner.id },
    ]) {
      await request(app)
        .patch(`${path}/${crypto.randomUUID()}`)
        .set('Authorization', owner.authorization)
        .send(body)
        .expect(400);
    }
    await request(app).get(`${path}/invalid`).set('Authorization', owner.authorization).expect(400);
    await request(app)
      .get(applicationTasksPath('invalid'))
      .set('Authorization', owner.authorization)
      .expect(400);
    for (const query of [
      { due: 'today' },
      { due: 'overdue', today: '2026-02-30' },
      { due: 'invalid' },
      { status: 'overdue' },
      { sortBy: 'invalid' },
      { pageSize: '101' },
    ]) {
      await request(app)
        .get(tasksPath)
        .set('Authorization', owner.authorization)
        .query(query)
        .expect(400);
    }
  });

  it('filters and sorts owned tasks before pagination, using the supplied local date', async () => {
    const owner = await createOwner();
    const stranger = await createOwner();
    const first = await createApplication(owner.id);
    const second = await createApplication(owner.id);
    const crossUser = await createApplication(stranger.id);
    const hiddenCompany = await createApplication(owner.id);
    const hiddenApplication = await createApplication(owner.id);
    const yesterday = await createTask(first.application.id, {
      dueOn: '2026-11-10',
      priority: 'low',
    });
    const earlier = await createTask(second.application.id, {
      dueOn: '2026-11-09',
      priority: 'high',
    });
    const today = await createTask(first.application.id, { dueOn: '2026-11-11' });
    const tomorrow = await createTask(second.application.id, { dueOn: '2026-11-12' });
    const undated = await createTask(first.application.id);
    const completed = await createTask(second.application.id, {
      dueOn: '2026-11-08',
      completedAt: new Date(),
    });
    const deleted = await createTask(first.application.id, { dueOn: '2026-11-06' });
    await createTask(crossUser.application.id, { dueOn: '2026-11-06' });
    await createTask(hiddenCompany.application.id, { dueOn: '2026-11-06' });
    await createTask(hiddenApplication.application.id, { dueOn: '2026-11-06' });
    await deleted.destroy();
    await hiddenCompany.company.destroy();
    await hiddenApplication.application.destroy();

    const list = async (query: Record<string, string | number> = {}) => {
      const response = await request(app)
        .get(tasksPath)
        .set('Authorization', owner.authorization)
        .query(query)
        .expect(200);
      return response.body as ApiResponse<{ tasks: TaskListItemDto[] }>;
    };
    const all = await list();
    expect(all.data?.tasks.map(({ id }) => id)).toEqual([
      completed.id,
      earlier.id,
      yesterday.id,
      today.id,
      tomorrow.id,
      undated.id,
    ]);
    expect(all.data?.tasks[1]?.application).toEqual({
      id: second.application.id,
      jobTitle: second.application.jobTitle,
    });
    const overdue = await list({ due: 'overdue', today: '2026-11-11', page: 2, pageSize: 1 });
    expect(overdue.meta).toEqual({ page: 2, pageSize: 1, total: 2, totalPages: 2 });
    expect(overdue.data?.tasks.map(({ id }) => id)).toEqual([yesterday.id]);
    for (const [due, expected] of [
      ['today', today.id],
      ['upcoming', tomorrow.id],
      ['undated', undated.id],
    ]) {
      const result = await list({ due: due ?? '', today: '2026-11-11' });
      expect(result.data?.tasks.map(({ id }) => id)).toEqual([expected]);
    }
    expect((await list({ status: 'completed' })).data?.tasks.map(({ id }) => id)).toEqual([
      completed.id,
    ]);
    expect(
      (await list({ status: 'open', priority: 'high' })).data?.tasks.map(({ id }) => id),
    ).toEqual([earlier.id]);
    const byPriority = await list({ sortBy: 'priority', sortDirection: 'desc' });
    expect(byPriority.data?.tasks.at(0)?.id).toBe(earlier.id);
    expect(byPriority.data?.tasks.at(-1)?.id).toBe(yesterday.id);
  });
});
