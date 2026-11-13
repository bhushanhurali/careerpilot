import { DataTypes, QueryInterface } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('resumes', {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    },
    title: { type: DataTypes.STRING(160), allowNull: false },
    original_filename: { type: DataTypes.STRING(255), allowNull: false },
    mime_type: { type: DataTypes.STRING(127), allowNull: false },
    file_size_bytes: { type: DataTypes.INTEGER, allowNull: false },
    storage_key: { type: DataTypes.UUID, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
  });

  await queryInterface.addConstraint('resumes', {
    fields: ['title', 'original_filename'],
    type: 'check',
    name: 'resumes_names_not_blank_check',
    where: queryInterface.sequelize.literal(
      "title <> '' AND title !~ '^[[:space:]]|[[:space:]]$' AND original_filename ~ '[^[:space:]]'",
    ),
  });
  await queryInterface.addConstraint('resumes', {
    fields: ['mime_type'],
    type: 'check',
    name: 'resumes_mime_type_check',
    where: {
      mime_type: [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ],
    },
  });
  await queryInterface.addConstraint('resumes', {
    fields: ['file_size_bytes'],
    type: 'check',
    name: 'resumes_file_size_positive_check',
    where: queryInterface.sequelize.literal('file_size_bytes > 0'),
  });
  await queryInterface.addConstraint('resumes', {
    fields: ['storage_key'],
    type: 'unique',
    name: 'resumes_storage_key_unique',
  });
  await queryInterface.addConstraint('resumes', {
    fields: ['storage_key'],
    type: 'check',
    name: 'resumes_storage_key_v4_check',
    where: queryInterface.sequelize.literal(
      "storage_key::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'",
    ),
  });

  await queryInterface.addIndex('resumes', ['user_id'], { name: 'resumes_user_id_idx' });
  await queryInterface.addIndex('resumes', ['user_id', 'created_at', 'id'], {
    name: 'resumes_active_user_created_at_idx',
    where: { deleted_at: null },
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('resumes');
}
