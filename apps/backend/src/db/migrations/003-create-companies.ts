import { DataTypes, QueryInterface } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('companies', {
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
    name: {
      type: DataTypes.STRING(160),
      allowNull: false,
    },
    website: {
      type: DataTypes.STRING(2048),
      allowNull: true,
    },
    industry: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    location: {
      type: DataTypes.STRING(160),
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

  await queryInterface.addConstraint('companies', {
    fields: ['name'],
    type: 'check',
    name: 'companies_name_trimmed_not_empty_check',
    where: queryInterface.sequelize.literal("name = btrim(name) AND btrim(name) <> ''"),
  });

  await queryInterface.addIndex('companies', ['user_id'], {
    name: 'companies_user_id_idx',
  });
  await queryInterface.addIndex('companies', ['user_id', 'name'], {
    name: 'companies_user_id_name_idx',
  });
  await queryInterface.sequelize.query(
    'CREATE UNIQUE INDEX companies_user_id_name_active_unique ON companies (user_id, lower(btrim(name))) WHERE deleted_at IS NULL;',
  );
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(
    'DROP INDEX IF EXISTS companies_user_id_name_active_unique;',
  );
  await queryInterface.removeIndex('companies', 'companies_user_id_name_idx');
  await queryInterface.removeIndex('companies', 'companies_user_id_idx');
  await queryInterface.removeConstraint('companies', 'companies_name_trimmed_not_empty_check');
  await queryInterface.dropTable('companies');
}
