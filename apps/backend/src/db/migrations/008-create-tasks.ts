import { DataTypes, Op, QueryInterface } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('tasks', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
    },
    application_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'job_applications', key: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    title: {
      type: DataTypes.STRING(160),
      allowNull: false,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    due_on: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    priority: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'medium',
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  });

  await queryInterface.addConstraint('tasks', {
    fields: ['title'],
    type: 'check',
    name: 'tasks_title_trimmed_not_empty_check',
    where: queryInterface.sequelize.literal("title <> '' AND title !~ '^[[:space:]]|[[:space:]]$'"),
  });
  await queryInterface.addConstraint('tasks', {
    fields: ['priority'],
    type: 'check',
    name: 'tasks_priority_check',
    where: { priority: ['low', 'medium', 'high'] },
  });

  await queryInterface.addIndex('tasks', ['application_id'], {
    name: 'tasks_application_id_idx',
  });
  await queryInterface.addIndex('tasks', ['due_on', 'id'], {
    name: 'tasks_open_due_on_idx',
    where: { deleted_at: null, completed_at: null, due_on: { [Op.ne]: null } },
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.removeIndex('tasks', 'tasks_open_due_on_idx');
  await queryInterface.removeIndex('tasks', 'tasks_application_id_idx');
  await queryInterface.removeConstraint('tasks', 'tasks_priority_check');
  await queryInterface.removeConstraint('tasks', 'tasks_title_trimmed_not_empty_check');
  await queryInterface.dropTable('tasks');
}
