import crypto from 'node:crypto';

import { IncludeOptions, literal, Op, Order, Transaction, WhereOptions } from 'sequelize';

import { CompanyModel } from '../../db/models/company.model.js';
import { JobApplicationModel } from '../../db/models/job-application.model.js';
import { TaskModel } from '../../db/models/task.model.js';
import { sequelize } from '../../db/sequelize.js';
import { HttpError } from '../../shared/errors/http-error.js';
import { CreateTaskBody, ListTasksQuery, UpdateTaskBody } from './tasks.schemas.js';
import { TaskDto, TaskListResult } from './tasks.types.js';

function toTaskDto(task: TaskModel): TaskDto {
  return {
    id: task.id,
    applicationId: task.applicationId,
    title: task.title,
    notes: task.notes ?? null,
    dueOn: task.dueOn ?? null,
    priority: task.priority,
    completedAt: task.completedAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

function ownedCompany(userId: string): IncludeOptions {
  return { model: CompanyModel, as: 'company', required: true, where: { userId } };
}

function ownedApplication(userId: string): IncludeOptions {
  return {
    model: JobApplicationModel,
    as: 'application',
    required: true,
    attributes: ['id', 'jobTitle'],
    where: { userId },
    include: [{ ...ownedCompany(userId), attributes: [] }],
  };
}

function taskFilters(query: ListTasksQuery): WhereOptions<TaskModel> {
  const filters: WhereOptions<TaskModel>[] = [];
  if (query.priority) {
    filters.push({ priority: query.priority });
  }
  if (query.status === 'open' || query.due) {
    filters.push({ completedAt: null });
  }
  if (query.status === 'completed') {
    filters.push({ completedAt: { [Op.ne]: null } });
  }
  if (query.due === 'undated') {
    filters.push({ dueOn: null });
  } else if (query.today) {
    switch (query.due) {
      case 'overdue':
        filters.push({ dueOn: { [Op.lt]: query.today } });
        break;
      case 'today':
        filters.push({ dueOn: query.today });
        break;
      case 'upcoming':
        filters.push({ dueOn: { [Op.gt]: query.today } });
        break;
    }
  }

  return { [Op.and]: filters };
}

function taskOrder(sortBy: ListTasksQuery['sortBy'], sortDirection: 'asc' | 'desc'): Order {
  const direction = sortDirection === 'asc' ? 'ASC' : 'DESC';
  const sortField =
    sortBy === 'priority'
      ? literal('CASE "TaskModel"."priority" WHEN \'low\' THEN 1 WHEN \'medium\' THEN 2 ELSE 3 END')
      : sortBy;

  return [
    [sortField, `${direction} NULLS LAST`],
    ['id', 'ASC'],
  ];
}

export class TasksService {
  async listTasks(userId: string, query: ListTasksQuery): Promise<TaskListResult> {
    const { count, rows } = await TaskModel.findAndCountAll({
      where: taskFilters(query),
      include: [ownedApplication(userId)],
      order: taskOrder(query.sortBy, query.sortDirection),
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    });

    return {
      tasks: rows.map((task) => {
        const application = task.get('application') as JobApplicationModel;
        return {
          ...toTaskDto(task),
          application: { id: application.id, jobTitle: application.jobTitle },
        };
      }),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total: count,
        totalPages: Math.ceil(count / query.pageSize),
      },
    };
  }

  async listApplicationTasks(userId: string, applicationId: string): Promise<TaskDto[]> {
    await this.assertOwnedApplication(userId, applicationId);
    const tasks = await TaskModel.findAll({
      where: { applicationId },
      include: [ownedApplication(userId)],
      order: taskOrder('dueOn', 'asc'),
    });

    return tasks.map(toTaskDto);
  }

  async getTask(userId: string, applicationId: string, taskId: string): Promise<TaskDto> {
    await this.assertOwnedApplication(userId, applicationId);
    return toTaskDto(await this.findTask(userId, applicationId, taskId));
  }

  async createTask(userId: string, applicationId: string, input: CreateTaskBody): Promise<TaskDto> {
    return sequelize.transaction(async (transaction) => {
      await this.assertOwnedApplication(userId, applicationId, transaction);
      const task = await TaskModel.create(
        { ...input, id: crypto.randomUUID(), applicationId },
        { transaction },
      );
      return toTaskDto(task);
    });
  }

  async updateTask(
    userId: string,
    applicationId: string,
    taskId: string,
    input: UpdateTaskBody,
  ): Promise<TaskDto> {
    return sequelize.transaction(async (transaction) => {
      await this.assertOwnedApplication(userId, applicationId, transaction);
      const task = await this.findTask(userId, applicationId, taskId, transaction);
      if (input.title !== undefined) task.title = input.title;
      if (input.notes !== undefined) task.notes = input.notes;
      if (input.dueOn !== undefined) task.dueOn = input.dueOn;
      if (input.priority !== undefined) task.priority = input.priority;
      if (input.completed === true && !task.completedAt) task.completedAt = new Date();
      if (input.completed === false) task.completedAt = null;
      await task.save({ transaction });

      return toTaskDto(task);
    });
  }

  async deleteTask(userId: string, applicationId: string, taskId: string): Promise<void> {
    await sequelize.transaction(async (transaction) => {
      await this.assertOwnedApplication(userId, applicationId, transaction);
      const task = await this.findTask(userId, applicationId, taskId, transaction);
      await task.destroy({ transaction });
    });
  }

  private async assertOwnedApplication(
    userId: string,
    applicationId: string,
    transaction?: Transaction,
  ): Promise<void> {
    const application = await JobApplicationModel.findOne({
      where: { id: applicationId, userId },
      include: [ownedCompany(userId)],
      ...(transaction ? { transaction, lock: transaction.LOCK.UPDATE } : {}),
    });
    if (!application) {
      throw new HttpError(404, 'APPLICATION_NOT_FOUND', 'Application was not found');
    }
  }

  private async findTask(
    userId: string,
    applicationId: string,
    taskId: string,
    transaction?: Transaction,
  ): Promise<TaskModel> {
    const task = await TaskModel.findOne({
      where: { id: taskId, applicationId },
      include: [ownedApplication(userId)],
      ...(transaction
        ? { transaction, lock: { level: transaction.LOCK.UPDATE, of: TaskModel } }
        : {}),
    });
    if (!task) {
      throw new HttpError(404, 'TASK_NOT_FOUND', 'Task was not found');
    }
    return task;
  }
}
