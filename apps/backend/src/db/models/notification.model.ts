import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize';

export type NotificationType = 'interview_reminder' | 'task_due' | 'task_overdue';

export class NotificationModel extends Model<
  InferAttributes<NotificationModel>,
  InferCreationAttributes<NotificationModel>
> {
  declare id: string;
  declare userId: string;
  declare type: NotificationType;
  declare interviewId: CreationOptional<string | null>;
  declare taskId: CreationOptional<string | null>;
  declare interviewScheduledAt: CreationOptional<Date | null>;
  declare taskDueOn: CreationOptional<string | null>;
  declare scheduledFor: Date;
  declare deliveredAt: CreationOptional<Date | null>;
  declare readAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  static initialize(sequelize: Sequelize): void {
    NotificationModel.init(
      {
        id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
        userId: { type: DataTypes.UUID, allowNull: false },
        type: { type: DataTypes.STRING(32), allowNull: false },
        interviewId: { type: DataTypes.UUID, allowNull: true },
        taskId: { type: DataTypes.UUID, allowNull: true },
        interviewScheduledAt: { type: DataTypes.DATE, allowNull: true },
        taskDueOn: { type: DataTypes.DATEONLY, allowNull: true },
        scheduledFor: { type: DataTypes.DATE, allowNull: false },
        deliveredAt: { type: DataTypes.DATE, allowNull: true },
        readAt: { type: DataTypes.DATE, allowNull: true },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false },
      },
      { sequelize, tableName: 'notifications', underscored: true },
    );
  }
}
