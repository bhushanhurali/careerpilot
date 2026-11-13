import { DataTypes, Op, QueryInterface } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.createTable(
      'notifications',
      {
        id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
        user_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
        type: { type: DataTypes.STRING(32), allowNull: false },
        interview_id: {
          type: DataTypes.UUID,
          allowNull: true,
          references: { model: 'interviews', key: 'id' },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
        task_id: {
          type: DataTypes.UUID,
          allowNull: true,
          references: { model: 'tasks', key: 'id' },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
        interview_scheduled_at: { type: DataTypes.DATE, allowNull: true },
        task_due_on: { type: DataTypes.DATEONLY, allowNull: true },
        scheduled_for: { type: DataTypes.DATE, allowNull: false },
        delivered_at: { type: DataTypes.DATE, allowNull: true },
        read_at: { type: DataTypes.DATE, allowNull: true },
        created_at: { type: DataTypes.DATE, allowNull: false },
        updated_at: { type: DataTypes.DATE, allowNull: false },
      },
      { transaction },
    );

    await queryInterface.addConstraint('notifications', {
      fields: ['type', 'interview_id', 'task_id', 'interview_scheduled_at', 'task_due_on'],
      type: 'check',
      name: 'notifications_source_check',
      where: queryInterface.sequelize.literal(`
        (type = 'interview_reminder' AND interview_id IS NOT NULL
          AND interview_scheduled_at IS NOT NULL AND task_id IS NULL AND task_due_on IS NULL)
        OR
        (type IN ('task_due', 'task_overdue') AND task_id IS NOT NULL
          AND task_due_on IS NOT NULL AND interview_id IS NULL AND interview_scheduled_at IS NULL)
      `),
      transaction,
    });
    await queryInterface.addConstraint('notifications', {
      fields: ['read_at', 'delivered_at', 'scheduled_for'],
      type: 'check',
      name: 'notifications_lifecycle_check',
      where: queryInterface.sequelize.literal(`
        (delivered_at IS NULL OR delivered_at >= scheduled_for)
        AND (read_at IS NULL OR (delivered_at IS NOT NULL AND read_at >= delivered_at))
      `),
      transaction,
    });

    await queryInterface.addIndex('notifications', ['interview_id', 'interview_scheduled_at'], {
      name: 'notifications_interview_event_unique',
      unique: true,
      where: { interview_id: { [Op.ne]: null } },
      transaction,
    });
    await queryInterface.addIndex('notifications', ['task_id', 'task_due_on', 'type'], {
      name: 'notifications_task_event_unique',
      unique: true,
      where: { task_id: { [Op.ne]: null } },
      transaction,
    });
    await queryInterface.addIndex('notifications', ['scheduled_for', 'id'], {
      name: 'notifications_pending_idx',
      where: { delivered_at: null },
      transaction,
    });
    await queryInterface.addIndex('notifications', ['user_id', 'delivered_at', 'id'], {
      name: 'notifications_user_inbox_idx',
      transaction,
    });
    await queryInterface.addIndex('notifications', ['user_id'], {
      name: 'notifications_unread_idx',
      where: { delivered_at: { [Op.ne]: null }, read_at: null },
      transaction,
    });
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('notifications');
}
