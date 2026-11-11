export const taskPriorities = ['low', 'medium', 'high'] as const;

export type TaskPriority = (typeof taskPriorities)[number];
export type TaskDueFilter = 'overdue' | 'today' | 'upcoming' | 'undated';
export type TaskSort = 'dueOn' | 'priority' | 'createdAt' | 'completedAt';

export type TaskFormValue = {
  title: string;
  notes: string | null;
  dueOn: string | null;
  priority: TaskPriority;
};

export type Task = TaskFormValue & {
  id: string;
  applicationId: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TaskListItem = Task & { application?: { id: string; jobTitle: string } };

export type TaskListQuery = {
  page: number;
  pageSize: number;
  status?: 'open' | 'completed';
  due?: TaskDueFilter;
  today?: string;
  priority?: TaskPriority;
  sortBy: TaskSort;
  sortDirection: 'asc' | 'desc';
};

export type TaskListResult = { tasks: TaskListItem[]; total: number };

export function localCalendarDate(date = new Date()): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}
