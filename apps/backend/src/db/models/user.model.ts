import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize';

export type UserRole = 'user' | 'admin';

export class UserModel extends Model<
  InferAttributes<UserModel>,
  InferCreationAttributes<UserModel>
> {
  declare id: string;
  declare email: string;
  declare passwordHash: string;
  declare firstName: string;
  declare lastName: string;
  declare role: CreationOptional<UserRole>;
  declare isActive: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare deletedAt: CreationOptional<Date | null>;

  static initialize(sequelize: Sequelize): void {
    UserModel.init(
      {
        id: {
          type: DataTypes.UUID,
          primaryKey: true,
          allowNull: false,
        },
        email: {
          type: DataTypes.STRING(320),
          allowNull: false,
        },
        passwordHash: {
          type: DataTypes.TEXT,
          allowNull: false,
          field: 'password_hash',
        },
        firstName: {
          type: DataTypes.STRING(80),
          allowNull: false,
          field: 'first_name',
        },
        lastName: {
          type: DataTypes.STRING(80),
          allowNull: false,
          field: 'last_name',
        },
        role: {
          type: DataTypes.STRING(40),
          allowNull: false,
          defaultValue: 'user',
        },
        isActive: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
          field: 'is_active',
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
        tableName: 'users',
        underscored: true,
        paranoid: true,
      },
    );
  }
}
