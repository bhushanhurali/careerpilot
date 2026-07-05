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

function normalizeOptionalEmail(value: string | null | undefined): string | null {
  const normalizedValue = normalizeOptionalText(value);

  return normalizedValue ? normalizedValue.toLowerCase() : null;
}

export class ContactModel extends Model<
  InferAttributes<ContactModel>,
  InferCreationAttributes<ContactModel>
> {
  declare id: string;
  declare companyId: string;
  declare firstName: string;
  declare lastName: CreationOptional<string | null>;
  declare email: CreationOptional<string | null>;
  declare phone: CreationOptional<string | null>;
  declare roleTitle: CreationOptional<string | null>;
  declare linkedInUrl: CreationOptional<string | null>;
  declare notes: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare deletedAt: CreationOptional<Date | null>;

  static initialize(sequelize: Sequelize): void {
    ContactModel.init(
      {
        id: {
          type: DataTypes.UUID,
          primaryKey: true,
          allowNull: false,
        },
        companyId: {
          type: DataTypes.UUID,
          allowNull: false,
          field: 'company_id',
        },
        firstName: {
          type: DataTypes.STRING(80),
          allowNull: false,
          field: 'first_name',
          set(value: string) {
            this.setDataValue('firstName', value.trim());
          },
        },
        lastName: {
          type: DataTypes.STRING(80),
          allowNull: true,
          field: 'last_name',
          set(value: string | null | undefined) {
            this.setDataValue('lastName', normalizeOptionalText(value));
          },
        },
        email: {
          type: DataTypes.STRING(320),
          allowNull: true,
          set(value: string | null | undefined) {
            this.setDataValue('email', normalizeOptionalEmail(value));
          },
        },
        phone: {
          type: DataTypes.STRING(40),
          allowNull: true,
          set(value: string | null | undefined) {
            this.setDataValue('phone', normalizeOptionalText(value));
          },
        },
        roleTitle: {
          type: DataTypes.STRING(120),
          allowNull: true,
          field: 'role_title',
          set(value: string | null | undefined) {
            this.setDataValue('roleTitle', normalizeOptionalText(value));
          },
        },
        linkedInUrl: {
          type: DataTypes.STRING(2048),
          allowNull: true,
          field: 'linked_in_url',
          set(value: string | null | undefined) {
            this.setDataValue('linkedInUrl', normalizeOptionalText(value));
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
        tableName: 'contacts',
        underscored: true,
        paranoid: true,
      },
    );
  }
}
