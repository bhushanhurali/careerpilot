import { randomUUID } from 'node:crypto';

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createMigrator } from '../../db/migrator.js';
import { CompanyModel } from '../../db/models/company.model.js';
import { InterviewModel } from '../../db/models/interview.model.js';
import { JobApplicationModel } from '../../db/models/job-application.model.js';
import { NotificationModel } from '../../db/models/notification.model.js';
import { TaskModel } from '../../db/models/task.model.js';
import { UserModel } from '../../db/models/user.model.js';
import { sequelize } from '../../db/sequelize.js';

const scheduledFor = new Date('2026-11-14T09:00:00Z');
const interviewScheduledAt = new Date('2026-11-15T09:00:00Z');

async function createSources() {
  const user = await UserModel.create({
    id: randomUUID(),
    email: `${randomUUID()}@example.com`,
    passwordHash: 'test',
    firstName: 'Test',
    lastName: 'User',
  });
  const company = await CompanyModel.create({ id: randomUUID(), userId: user.id, name: 'Example' });
  const application = await JobApplicationModel.create({
    id: randomUUID(),
    userId: user.id,
    companyId: company.id,
    jobTitle: 'Engineer',
  });
  const interview = await InterviewModel.create({
    id: randomUUID(),
    applicationId: application.id,
    type: 'technical',
    status: 'scheduled',
    scheduledAt: interviewScheduledAt,
  });
  const task = await TaskModel.create({
    id: randomUUID(),
    applicationId: application.id,
    title: 'Follow up',
    dueOn: '2026-11-14',
  });
  const taskEvent = {
    userId: user.id,
    type: 'task_due',
    taskId: task.id,
    taskDueOn: '2026-11-14',
    scheduledFor,
  } as const;
  const interviewEvent = {
    userId: user.id,
    type: 'interview_reminder',
    interviewId: interview.id,
    interviewScheduledAt,
    scheduledFor,
  } as const;
  return { user, application, interview, task, taskEvent, interviewEvent };
}

describe('notification database foundation', () => {
  beforeAll(async () => {
    await createMigrator().up();
  });
  beforeEach(async () => {
    await sequelize.query('TRUNCATE TABLE users CASCADE');
  });

  it('loads direct ownership and source associations and preserves date-only event identity', async () => {
    const { user, task, taskEvent } = await createSources();
    const notification = await NotificationModel.create({ id: randomUUID(), ...taskEvent });
    await notification.reload({ include: ['user', 'task'] });

    expect(notification.get('user')).toMatchObject({ id: user.id });
    expect(notification.get('task')).toMatchObject({ id: task.id });
    expect(notification.taskDueOn).toBe('2026-11-14');
    expect(notification.deliveredAt).toBeNull();
    expect(notification.readAt).toBeNull();
    await notification.update({ deliveredAt: scheduledFor, readAt: scheduledFor });
    await notification.reload();
    expect(notification.readAt).toEqual(scheduledFor);
  });

  it('deduplicates retries independently of scheduling time and allows changed source events', async () => {
    const { taskEvent, interviewEvent } = await createSources();
    const addTask = (values: Partial<NotificationModel> = {}) =>
      NotificationModel.create({ id: randomUUID(), ...taskEvent, ...values });
    const addInterview = (values: Partial<NotificationModel> = {}) =>
      NotificationModel.create({ id: randomUUID(), ...interviewEvent, ...values });
    const results = await Promise.allSettled([addTask(), addTask()]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((result) => result.status === 'rejected')).toMatchObject({
      reason: { parent: { constraint: 'notifications_task_event_unique' } },
    });
    await addTask({ type: 'task_overdue' });
    await expect(
      addTask({ type: 'task_overdue', scheduledFor: new Date('2026-11-16T09:00:00Z') }),
    ).rejects.toMatchObject({ parent: { constraint: 'notifications_task_event_unique' } });
    await addTask({ taskDueOn: '2026-11-16' });
    await addInterview();
    await expect(addInterview()).rejects.toMatchObject({
      parent: { constraint: 'notifications_interview_event_unique' },
    });
    await addInterview({ interviewScheduledAt: new Date('2026-11-16T09:00:00Z') });
  });

  it('rejects invalid sources, missing references, and impossible read/delivery state', async () => {
    const { taskEvent, interview } = await createSources();
    const create = (values: Partial<NotificationModel>) =>
      NotificationModel.create({ id: randomUUID(), ...taskEvent, ...values });
    for (const values of [
      { taskId: null },
      { taskDueOn: null },
      { interviewId: interview.id },
      { type: 'interview_reminder' },
    ] as const) {
      await expect(create(values)).rejects.toMatchObject({
        parent: { constraint: 'notifications_source_check' },
      });
    }
    await expect(create({ taskId: randomUUID() })).rejects.toMatchObject({
      parent: { code: '23503' },
    });
    await expect(create({ userId: randomUUID() })).rejects.toMatchObject({
      parent: { code: '23503' },
    });
    await expect(create({ readAt: scheduledFor })).rejects.toMatchObject({
      parent: { constraint: 'notifications_lifecycle_check' },
    });
  });

  it('retains notification rows on soft deletion and cascades on physical source deletion', async () => {
    const { interview, interviewEvent, task, taskEvent } = await createSources();
    await NotificationModel.create({ id: randomUUID(), ...interviewEvent });
    await NotificationModel.create({ id: randomUUID(), ...taskEvent });
    await interview.destroy();
    await task.destroy();
    expect(await NotificationModel.count()).toBe(2);
    await interview.destroy({ force: true });
    await task.destroy({ force: true });
    expect(await NotificationModel.count()).toBe(0);
  });
});
