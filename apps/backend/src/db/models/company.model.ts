import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize';

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
}

export class CompanyModel extends Model<
  InferAttributes<CompanyModel>,
  InferCreationAttributes<CompanyModel>
> {
  declare id: string;
  declare userId: string;
  declare name: string;
  declare website: CreationOptional<string | null>;
  declare industry: CreationOptional<string | null>;
  declare location: CreationOptional<string | null>;
  declare notes: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare deletedAt: CreationOptional<Date | null>;

  static initialize(sequelize: Sequelize): void {
    CompanyModel.init(
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
        name: {
          type: DataTypes.STRING(160),
          allowNull: false,
          set(value: string) {
            this.setDataValue('name', value.trim());
          },
        },
        website: {
          type: DataTypes.STRING(2048),
          allowNull: true,
          set(value: string | null | undefined) {
            this.setDataValue('website', normalizeOptionalText(value));
          },
        },
        industry: {
          type: DataTypes.STRING(120),
          allowNull: true,
          set(value: string | null | undefined) {
            this.setDataValue('industry', normalizeOptionalText(value));
          },
        },
        location: {
          type: DataTypes.STRING(160),
          allowNull: true,
          set(value: string | null | undefined) {
            this.setDataValue('location', normalizeOptionalText(value));
          },
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: true,
          set(value: string | null | undefined) {
            this.setDataValue('notes', normalizeOptionalText(value));
          },
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
        deletedAt: {
          type: DataTypes.DATE,
          allowNull: true,
          field: 'deleted_at',
        },
      },
      {
        sequelize,
        tableName: 'companies',
        underscored: true,
        paranoid: true,
      },
    );
  }
}
