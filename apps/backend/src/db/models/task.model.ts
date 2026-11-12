import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize';

export type TaskPriority = 'low' | 'medium' | 'high';

export class TaskModel extends Model<
  InferAttributes<TaskModel>,
  InferCreationAttributes<TaskModel>
> {
  declare id: string;
  declare applicationId: string;
  declare title: string;
  declare notes: CreationOptional<string | null>;
  declare dueOn: CreationOptional<string | null>;
  declare priority: CreationOptional<TaskPriority>;
  declare completedAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare deletedAt: CreationOptional<Date | null>;

  static initialize(sequelize: Sequelize): void {
    TaskModel.init(
      {
        id: {
          type: DataTypes.UUID,
          primaryKey: true,
          allowNull: false,
        },
        applicationId: {
          type: DataTypes.UUID,
          allowNull: false,
          field: 'application_id',
        },
        title: {
          type: DataTypes.STRING(160),
          allowNull: false,
          set(value: string) {
            this.setDataValue('title', value.trim());
          },
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: true,
          set(value: string | null | undefined) {
            const trimmed = value?.trim() ?? '';
            this.setDataValue('notes', trimmed === '' ? null : trimmed);
          },
        },
        dueOn: {
          type: DataTypes.DATEONLY,
          allowNull: true,
          field: 'due_on',
        },
        priority: {
          type: DataTypes.STRING(20),
          allowNull: false,
          defaultValue: 'medium',
        },
        completedAt: {
          type: DataTypes.DATE,
          allowNull: true,
          field: 'completed_at',
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
        tableName: 'tasks',
        underscored: true,
        paranoid: true,
      },
    );
  }
}
