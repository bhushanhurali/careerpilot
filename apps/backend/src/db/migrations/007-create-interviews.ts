import { DataTypes, QueryInterface } from 'sequelize';

const interviewTypeValues = [
  'phone_screen',
  'recruiter_screen',
  'technical',
  'coding',
  'system_design',
  'hiring_manager',
  'onsite',
  'hr',
  'final',
  'other',
];

const interviewStatusValues = ['scheduled', 'completed', 'cancelled', 'rescheduled', 'no_show'];

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('interviews', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
    },
    application_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'job_applications',
        key: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    type: {
      type: DataTypes.STRING(40),
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(40),
      allowNull: false,
    },
    scheduled_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    duration_minutes: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    location: {
      type: DataTypes.STRING(160),
      allowNull: true,
    },
    meeting_url: {
      type: DataTypes.STRING(2048),
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
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

  const allowedTypes = interviewTypeValues.map((type) => `'${type}'`).join(', ');
  const allowedStatuses = interviewStatusValues.map((status) => `'${status}'`).join(', ');

  await queryInterface.addConstraint('interviews', {
    fields: ['type'],
    type: 'check',
    name: 'interviews_type_check',
    where: queryInterface.sequelize.literal(`type IN (${allowedTypes})`),
  });
  await queryInterface.addConstraint('interviews', {
    fields: ['status'],
    type: 'check',
    name: 'interviews_status_check',
    where: queryInterface.sequelize.literal(`status IN (${allowedStatuses})`),
  });
  await queryInterface.addConstraint('interviews', {
    fields: ['duration_minutes'],
    type: 'check',
    name: 'interviews_duration_minutes_positive_check',
    where: queryInterface.sequelize.literal('duration_minutes IS NULL OR duration_minutes > 0'),
  });

  await queryInterface.addIndex('interviews', ['application_id'], {
    name: 'interviews_application_id_idx',
  });
  await queryInterface.addIndex('interviews', ['application_id', 'scheduled_at'], {
    name: 'interviews_application_id_scheduled_at_idx',
  });
  await queryInterface.addIndex('interviews', ['scheduled_at'], {
    name: 'interviews_scheduled_at_idx',
  });
  await queryInterface.addIndex('interviews', ['status'], {
    name: 'interviews_status_idx',
  });
  await queryInterface.addIndex('interviews', ['type'], {
    name: 'interviews_type_idx',
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.removeIndex('interviews', 'interviews_type_idx');
  await queryInterface.removeIndex('interviews', 'interviews_status_idx');
  await queryInterface.removeIndex('interviews', 'interviews_scheduled_at_idx');
  await queryInterface.removeIndex('interviews', 'interviews_application_id_scheduled_at_idx');
  await queryInterface.removeIndex('interviews', 'interviews_application_id_idx');
  await queryInterface.removeConstraint('interviews', 'interviews_duration_minutes_positive_check');
  await queryInterface.removeConstraint('interviews', 'interviews_status_check');
  await queryInterface.removeConstraint('interviews', 'interviews_type_check');
  await queryInterface.dropTable('interviews');
}
