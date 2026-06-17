import { DataTypes, QueryInterface } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('refresh_tokens', {
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
    token_hash: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    family_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    revoked_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    replaced_by_token_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'refresh_tokens',
        key: 'id',
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
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

  await queryInterface.addIndex('refresh_tokens', ['user_id'], {
    name: 'refresh_tokens_user_id_idx',
  });
  await queryInterface.addIndex('refresh_tokens', ['token_hash'], {
    name: 'refresh_tokens_token_hash_idx',
  });
  await queryInterface.addIndex('refresh_tokens', ['family_id'], {
    name: 'refresh_tokens_family_id_idx',
  });
  await queryInterface.addIndex('refresh_tokens', ['expires_at'], {
    name: 'refresh_tokens_expires_at_idx',
  });
  await queryInterface.addIndex('refresh_tokens', ['revoked_at'], {
    name: 'refresh_tokens_revoked_at_idx',
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('refresh_tokens');
}
