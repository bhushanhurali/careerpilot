import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../app.js';
import { createMigrator } from '../../db/migrator.js';
import { CompanyModel } from '../../db/models/company.model.js';
import { InterviewModel } from '../../db/models/interview.model.js';
import { JobApplicationModel } from '../../db/models/job-application.model.js';
import { NotificationModel } from '../../db/models/notification.model.js';
import { TaskModel } from '../../db/models/task.model.js';
import { UserModel } from '../../db/models/user.model.js';
import { sequelize } from '../../db/sequelize.js';
import { signAccessToken } from '../../shared/security/jwt.js';
import { processReminders } from './reminder.scheduler.js';

const url = '/api/v1/notifications';
const app = createApp();
const run = (instant: string, zone = 'UTC') => processReminders(new Date(instant), zone);

async function fixture() {
  const id = randomUUID();
  const user = await UserModel.create({
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
  const task = (dueOn: string) =>
    TaskModel.create({
      id: randomUUID(),
      applicationId: application.id,
      dueOn,
      title: 'Follow up',
    });
  const interview = (instant: string) =>
    InterviewModel.create({
      id: randomUUID(),
      applicationId: application.id,
      scheduledAt: new Date(instant),
      type: 'technical',
      status: 'scheduled',
    });
  return {
    user,
    company,
    application,
    task,
    interview,
    auth: `Bearer ${signAccessToken({ id, role: 'user' })}`,
  };
}

describe('notification inbox and reminder processing', () => {
  beforeAll(async () => {
    await createMigrator().up();
  });
  beforeEach(async () => {
    await sequelize.query('TRUNCATE TABLE users CASCADE');
  });

  it('requires auth, validates pagination, and scopes inbox and read mutations to live ownership', async () => {
    const mine = await fixture();
    const other = await fixture();
    await mine.task('2026-03-29');
    const foreign = await other.task('2026-03-29');
    await run('2026-03-29T08:00:00Z');
    const foreignEvent = await NotificationModel.findOne({ where: { taskId: foreign.id } });
    if (!foreignEvent) throw new Error('Expected notification');
    const path = `${url}/${foreignEvent.id}/read`;
    await request(app).get(url).expect(401);
    await request(app).patch(path).expect(401);
    await request(app).get(`${url}?unread=maybe`).set('Authorization', mine.auth).expect(400);
    await request(app).get(`${url}?pageSize=101`).set('Authorization', mine.auth).expect(400);
    await request(app).patch(path).set('Authorization', mine.auth).expect(404);
    // Even an inconsistent recipient FK must not disclose the source.
    await foreignEvent.update({ userId: mine.user.id });
    await request(app).patch(path).set('Authorization', mine.auth).expect(404);
    const response = await request(app).get(url).set('Authorization', mine.auth).expect(200);
    expect(response.body).toMatchObject({ data: { unreadCount: 1 }, meta: { total: 1 } });
    await mine.user.update({ isActive: false });
    const inactive = await request(app).get(url).set('Authorization', mine.auth).expect(200);
    expect(inactive.body).toMatchObject({ data: { notifications: [], unreadCount: 0 } });
  });

  it('paginates consistently, counts all unread items, and marks read idempotently', async () => {
    const { auth, task } = await fixture();
    await task('2026-03-29');
    await task('2026-03-28');
    await run('2026-03-29T08:00:00Z');
    const unread = `${url}?unread=true&pageSize=1`;
    const first = await request(app)
      .get(unread)
      .set('Authorization', auth)
      .expect('Cache-Control', 'private, no-store')
      .expect(200);
    expect(first.body).toMatchObject({
      data: { unreadCount: 2 },
      meta: { total: 2, totalPages: 2 },
    });
    const second = await request(app)
      .get(`${unread}&page=2`)
      .set('Authorization', auth)
      .expect(200);
    const [event] = await NotificationModel.findAll({
      order: [
        ['deliveredAt', 'DESC'],
        ['id', 'DESC'],
      ],
    });
    if (!event) throw new Error('Expected notification');
    expect(first.body).toMatchObject({ data: { notifications: [{ id: event.id, readAt: null }] } });
    expect(second.body).not.toMatchObject({ data: { notifications: [{ id: event.id }] } });
    const path = `${url}/${event.id}/read`;
    const read = await request(app).patch(path).set('Authorization', auth).expect(200);
    const repeated = await request(app).patch(path).set('Authorization', auth).expect(200);
    expect(repeated.body).toEqual(read.body);
    const remaining = await request(app).get(unread).set('Authorization', auth).expect(200);
    expect(remaining.body).toMatchObject({ data: { unreadCount: 1 }, meta: { total: 1 } });
    const all = await request(app).get(url).set('Authorization', auth).expect(200);
    expect(all.body).toMatchObject({ data: { unreadCount: 1 }, meta: { total: 2 } });
  });

  it('uses elapsed 24 hours, catches missed runs before the interview, and deduplicates concurrent polls', async () => {
    const { interview } = await fixture();
    const source = await interview('2026-03-30T08:00:00Z');
    await interview('2026-03-29T07:59:59Z');
    await run('2026-03-29T07:59:59Z', 'Europe/Berlin');
    expect(await NotificationModel.count()).toBe(0);
    await Promise.all([
      run('2026-03-29T12:00:00Z', 'Europe/Berlin'),
      run('2026-03-29T12:00:00Z', 'Europe/Berlin'),
    ]);
    const events = await NotificationModel.findAll();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      interviewId: source.id,
      type: 'interview_reminder',
      scheduledFor: new Date('2026-03-29T08:00:00Z'),
      deliveredAt: new Date('2026-03-29T12:00:00Z'),
    });
  });

  it('uses date-only midnight boundaries through DST and catches up only overdue events after missed dates', async () => {
    const { task } = await fixture();
    const today = await task('2026-03-29');
    const missed = await task('2026-03-27');
    await run('2026-03-28T22:59:59Z', 'Europe/Berlin');
    expect(await NotificationModel.count({ where: { taskId: today.id } })).toBe(0);
    await run('2026-03-28T23:00:00Z', 'Europe/Berlin');
    await run('2026-03-29T21:59:59Z', 'Europe/Berlin');
    expect(await NotificationModel.count({ where: { taskId: today.id } })).toBe(1);
    await run('2026-03-29T22:00:00Z', 'Europe/Berlin');
    await run('2026-03-30T08:00:00Z', 'Europe/Berlin');
    const events = await NotificationModel.findAll({
      where: { taskId: today.id },
      order: [['scheduledFor', 'ASC']],
    });
    expect(events).toMatchObject([
      { type: 'task_due', taskDueOn: '2026-03-29', scheduledFor: new Date('2026-03-28T23:00:00Z') },
      {
        type: 'task_overdue',
        taskDueOn: '2026-03-29',
        scheduledFor: new Date('2026-03-29T22:00:00Z'),
      },
    ]);
    expect(await NotificationModel.findAll({ where: { taskId: missed.id } })).toMatchObject([
      { type: 'task_overdue' },
    ]);
  });

  it('honors the persisted not-before time of a pending event', async () => {
    const { user, interview } = await fixture();
    const source = await interview('2026-03-30T08:00:00Z');
    const scheduledFor = new Date('2026-03-29T10:00:00Z');
    const pending = await NotificationModel.create({
      id: randomUUID(),
      userId: user.id,
      type: 'interview_reminder',
      interviewId: source.id,
      interviewScheduledAt: source.scheduledAt,
      scheduledFor,
    });
    await run('2026-03-29T08:00:00Z');
    expect((await pending.reload()).deliveredAt).toBeNull();
    await Promise.all([run(scheduledFor.toISOString()), run(scheduledFor.toISOString())]);
    expect(await pending.reload()).toMatchObject({ scheduledFor, deliveredAt: scheduledFor });
    expect(await NotificationModel.count()).toBe(1);
  });

  it('does not generate reminders for inactive users or cancelled interviews', async () => {
    const inactive = await fixture();
    await inactive.task('2026-03-28');
    await inactive.user.update({ isActive: false });
    const active = await fixture();
    const source = await active.interview('2026-03-30T08:00:00Z');
    await source.update({ status: 'cancelled' });
    await run('2026-03-29T08:00:00Z');
    expect(await NotificationModel.count()).toBe(0);
  });

  it('delivers a matching pending row and hides old events after rescheduling or source changes', async () => {
    const { user, auth, interview, task, application, company } = await fixture();
    const source = await interview('2026-03-30T08:00:00Z');
    const pending = await NotificationModel.create({
      id: randomUUID(),
      userId: user.id,
      type: 'interview_reminder',
      interviewId: source.id,
      interviewScheduledAt: source.scheduledAt,
      scheduledFor: new Date('2026-03-29T08:00:00Z'),
    });
    const list = () => request(app).get(url).set('Authorization', auth).expect(200);
    expect((await list()).body).toMatchObject({ data: { unreadCount: 0 } });
    const followUp = await task('2026-03-29');
    await run('2026-03-29T08:00:00Z');
    await pending.reload();
    expect(pending.deliveredAt).toEqual(new Date('2026-03-29T08:00:00Z'));
    expect((await list()).body).toMatchObject({ data: { unreadCount: 2 } });

    await source.update({ scheduledAt: new Date('2026-03-31T08:00:00Z') });
    await followUp.update({ dueOn: '2026-03-30' });
    expect((await list()).body).toMatchObject({ data: { unreadCount: 0 } });
    await request(app).patch(`${url}/${pending.id}/read`).set('Authorization', auth).expect(404);
    await run('2026-03-30T08:00:00Z');
    expect((await list()).body).toMatchObject({ data: { unreadCount: 2 } });

    await source.update({ status: 'cancelled' });
    await followUp.update({ completedAt: new Date('2026-03-30T08:00:00Z') });
    expect((await list()).body).toMatchObject({ data: { unreadCount: 0 } });
    await followUp.update({ completedAt: null });
    await run('2026-03-30T08:01:00Z');
    expect(await NotificationModel.count()).toBe(4);
    await source.destroy();
    expect((await list()).body).toMatchObject({ data: { unreadCount: 1 } });
    await company.destroy();
    expect((await list()).body).toMatchObject({ data: { unreadCount: 0 } });
    await company.restore();
    await application.destroy();
    expect((await list()).body).toMatchObject({ data: { unreadCount: 0 } });
    await run('2026-03-31T08:00:00Z');
    expect(await NotificationModel.count()).toBe(4);
  });
});
