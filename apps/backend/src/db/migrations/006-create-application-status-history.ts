import crypto from 'node:crypto';

import { DataTypes, QueryInterface, QueryTypes } from 'sequelize';

type ExistingApplicationRow = {
  id: string;
  status: string;
  created_at: Date;
};

const statusValues = [
  'draft',
  'applied',
  'screening',
  'interviewing',
  'offer',
  'rejected',
  'withdrawn',
  'accepted',
];

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('application_status_history', {
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
    from_status: {
      type: DataTypes.STRING(40),
      allowNull: true,
    },
    to_status: {
      type: DataTypes.STRING(40),
      allowNull: false,
    },
    changed_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    note: {
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
  });

  const allowedStatuses = statusValues.map((status) => `'${status}'`).join(', ');

  await queryInterface.addConstraint('application_status_history', {
    fields: ['from_status'],
    type: 'check',
    name: 'application_status_history_from_status_check',
    where: queryInterface.sequelize.literal(
      `from_status IS NULL OR from_status IN (${allowedStatuses})`,
    ),
  });
  await queryInterface.addConstraint('application_status_history', {
    fields: ['to_status'],
    type: 'check',
    name: 'application_status_history_to_status_check',
    where: queryInterface.sequelize.literal(`to_status IN (${allowedStatuses})`),
  });

  await queryInterface.addIndex('application_status_history', ['application_id'], {
    name: 'application_status_history_application_id_idx',
  });
  await queryInterface.addIndex('application_status_history', ['application_id', 'changed_at'], {
    name: 'application_status_history_application_id_changed_at_idx',
  });

  const existingApplications = await queryInterface.sequelize.query<ExistingApplicationRow>(
    'SELECT id, status, created_at FROM job_applications;',
    { type: QueryTypes.SELECT },
  );

  if (existingApplications.length > 0) {
    await queryInterface.bulkInsert(
      'application_status_history',
      existingApplications.map((application) => ({
        id: crypto.randomUUID(),
        application_id: application.id,
        from_status: null,
        to_status: application.status,
        changed_at: application.created_at,
        note: null,
        created_at: application.created_at,
        updated_at: application.created_at,
      })),
    );
  }
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.removeIndex(
    'application_status_history',
    'application_status_history_application_id_changed_at_idx',
  );
  await queryInterface.removeIndex(
    'application_status_history',
    'application_status_history_application_id_idx',
  );
  await queryInterface.removeConstraint(
    'application_status_history',
    'application_status_history_to_status_check',
  );
  await queryInterface.removeConstraint(
    'application_status_history',
    'application_status_history_from_status_check',
  );
  await queryInterface.dropTable('application_status_history');
}
