import { DataTypes, QueryInterface } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('contacts', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
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
    first_name: {
      type: DataTypes.STRING(80),
      allowNull: false,
    },
    last_name: {
      type: DataTypes.STRING(80),
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(320),
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING(40),
      allowNull: true,
    },
    role_title: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    linked_in_url: {
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

  await queryInterface.addConstraint('contacts', {
    fields: ['first_name'],
    type: 'check',
    name: 'contacts_first_name_trimmed_not_empty_check',
    where: queryInterface.sequelize.literal(
      "first_name = btrim(first_name) AND btrim(first_name) <> ''",
    ),
  });

  await queryInterface.addIndex('contacts', ['company_id'], {
    name: 'contacts_company_id_idx',
  });
  await queryInterface.addIndex('contacts', ['company_id', 'last_name', 'first_name'], {
    name: 'contacts_company_id_name_idx',
  });
  await queryInterface.addIndex('contacts', ['company_id', 'email'], {
    name: 'contacts_company_id_email_idx',
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.removeIndex('contacts', 'contacts_company_id_email_idx');
  await queryInterface.removeIndex('contacts', 'contacts_company_id_name_idx');
  await queryInterface.removeIndex('contacts', 'contacts_company_id_idx');
  await queryInterface.removeConstraint('contacts', 'contacts_first_name_trimmed_not_empty_check');
  await queryInterface.dropTable('contacts');
}
