import type { TaskPriority } from '../../db/models/task.model.js';

export type TaskDto = {
  id: string;
  applicationId: string;
  title: string;
  notes: string | null;
  dueOn: string | null;
  priority: TaskPriority;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TaskListItemDto = TaskDto & {
  application: { id: string; jobTitle: string };
};

export type TaskListResult = {
  tasks: TaskListItemDto[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
};
