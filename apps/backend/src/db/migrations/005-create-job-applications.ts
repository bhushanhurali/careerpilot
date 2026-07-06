import { DataTypes, QueryInterface } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('job_applications', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    company_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'companies',
        key: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    contact_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'contacts',
        key: 'id',
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    },
    job_title: {
      type: DataTypes.STRING(160),
      allowNull: false,
    },
    job_url: {
      type: DataTypes.STRING(2048),
      allowNull: true,
    },
    source: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(40),
      allowNull: false,
      defaultValue: 'draft',
    },
    priority: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'medium',
    },
    salary_min: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    salary_max: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    salary_currency: {
      type: DataTypes.CHAR(3),
      allowNull: true,
    },
    location: {
      type: DataTypes.STRING(160),
      allowNull: true,
    },
    employment_type: {
      type: DataTypes.STRING(80),
      allowNull: true,
    },
    work_mode: {
      type: DataTypes.STRING(80),
      allowNull: true,
    },
    applied_at: {
      type: DataTypes.DATEONLY,
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

  await queryInterface.addConstraint('job_applications', {
    fields: ['job_title'],
    type: 'check',
    name: 'job_applications_job_title_trimmed_not_empty_check',
    where: queryInterface.sequelize.literal(
      "job_title = btrim(job_title) AND btrim(job_title) <> ''",
    ),
  });
  await queryInterface.addConstraint('job_applications', {
    fields: ['status'],
    type: 'check',
    name: 'job_applications_status_check',
    where: queryInterface.sequelize.literal(
      "status IN ('draft', 'applied', 'screening', 'interviewing', 'offer', 'rejected', 'withdrawn', 'accepted')",
    ),
  });
  await queryInterface.addConstraint('job_applications', {
    fields: ['priority'],
    type: 'check',
    name: 'job_applications_priority_check',
    where: queryInterface.sequelize.literal("priority IN ('low', 'medium', 'high')"),
  });
  await queryInterface.addConstraint('job_applications', {
    fields: ['salary_min', 'salary_max'],
    type: 'check',
    name: 'job_applications_salary_non_negative_check',
    where: queryInterface.sequelize.literal(
      '(salary_min IS NULL OR salary_min >= 0) AND (salary_max IS NULL OR salary_max >= 0)',
    ),
  });
  await queryInterface.addConstraint('job_applications', {
    fields: ['salary_min', 'salary_max'],
    type: 'check',
    name: 'job_applications_salary_range_check',
    where: queryInterface.sequelize.literal(
      'salary_min IS NULL OR salary_max IS NULL OR salary_min <= salary_max',
    ),
  });
  await queryInterface.addConstraint('job_applications', {
    fields: ['salary_min', 'salary_max', 'salary_currency'],
    type: 'check',
    name: 'job_applications_salary_currency_required_check',
    where: queryInterface.sequelize.literal(
      '(salary_min IS NULL AND salary_max IS NULL) OR salary_currency IS NOT NULL',
    ),
  });
  await queryInterface.addConstraint('job_applications', {
    fields: ['salary_currency'],
    type: 'check',
    name: 'job_applications_salary_currency_format_check',
    where: queryInterface.sequelize.literal(
      "salary_currency IS NULL OR salary_currency ~ '^[A-Z]{3}$'",
    ),
  });

  await queryInterface.addIndex('job_applications', ['user_id'], {
    name: 'job_applications_user_id_idx',
  });
  await queryInterface.addIndex('job_applications', ['user_id', 'status'], {
    name: 'job_applications_user_id_status_idx',
  });
  await queryInterface.addIndex('job_applications', ['user_id', 'company_id'], {
    name: 'job_applications_user_id_company_id_idx',
  });
  await queryInterface.addIndex('job_applications', ['user_id', 'contact_id'], {
    name: 'job_applications_user_id_contact_id_idx',
  });
  await queryInterface.addIndex('job_applications', ['user_id', 'applied_at'], {
    name: 'job_applications_user_id_applied_at_idx',
  });
  await queryInterface.addIndex('job_applications', ['user_id', 'updated_at'], {
    name: 'job_applications_user_id_updated_at_idx',
  });
  await queryInterface.addIndex('job_applications', ['user_id', 'job_title'], {
    name: 'job_applications_user_id_job_title_idx',
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.removeIndex('job_applications', 'job_applications_user_id_job_title_idx');
  await queryInterface.removeIndex('job_applications', 'job_applications_user_id_updated_at_idx');
  await queryInterface.removeIndex('job_applications', 'job_applications_user_id_applied_at_idx');
  await queryInterface.removeIndex('job_applications', 'job_applications_user_id_contact_id_idx');
  await queryInterface.removeIndex('job_applications', 'job_applications_user_id_company_id_idx');
  await queryInterface.removeIndex('job_applications', 'job_applications_user_id_status_idx');
  await queryInterface.removeIndex('job_applications', 'job_applications_user_id_idx');
  await queryInterface.removeConstraint(
    'job_applications',
    'job_applications_salary_currency_format_check',
  );
  await queryInterface.removeConstraint(
    'job_applications',
    'job_applications_salary_currency_required_check',
  );
  await queryInterface.removeConstraint('job_applications', 'job_applications_salary_range_check');
  await queryInterface.removeConstraint(
    'job_applications',
    'job_applications_salary_non_negative_check',
  );
  await queryInterface.removeConstraint('job_applications', 'job_applications_priority_check');
  await queryInterface.removeConstraint('job_applications', 'job_applications_status_check');
  await queryInterface.removeConstraint(
    'job_applications',
    'job_applications_job_title_trimmed_not_empty_check',
  );
  await queryInterface.dropTable('job_applications');
}
