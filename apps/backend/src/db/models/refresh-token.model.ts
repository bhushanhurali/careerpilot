import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize';

export class RefreshTokenModel extends Model<
  InferAttributes<RefreshTokenModel>,
  InferCreationAttributes<RefreshTokenModel>
> {
  declare id: string;
  declare userId: string;
  declare tokenHash: string;
  declare familyId: string;
  declare expiresAt: Date;
  declare revokedAt: CreationOptional<Date | null>;
  declare replacedByTokenId: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  static initialize(sequelize: Sequelize): void {
    RefreshTokenModel.init(
      {
        id: {
          type: DataTypes.UUID,
          primaryKey: true,
          allowNull: false,
        },
        userId: {
          type: DataTypes.UUID,
          allowNull: false,
          field: 'user_id',
        },
        tokenHash: {
          type: DataTypes.TEXT,
          allowNull: false,
          field: 'token_hash',
        },
        familyId: {
          type: DataTypes.UUID,
          allowNull: false,
          field: 'family_id',
        },
        expiresAt: {
          type: DataTypes.DATE,
          allowNull: false,
          field: 'expires_at',
        },
        revokedAt: {
          type: DataTypes.DATE,
          allowNull: true,
          field: 'revoked_at',
        },
        replacedByTokenId: {
          type: DataTypes.UUID,
          allowNull: true,
          field: 'replaced_by_token_id',
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
          field: 'created_at',
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
          field: 'updated_at',
        },
      },
      {
        sequelize,
        tableName: 'refresh_tokens',
        underscored: true,
      },
    );
  }
}
