import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize';

export type InterviewType =
  | 'phone_screen'
  | 'recruiter_screen'
  | 'technical'
  | 'coding'
  | 'system_design'
  | 'hiring_manager'
  | 'onsite'
  | 'hr'
  | 'final'
  | 'other';

export type InterviewStatus = 'scheduled' | 'completed' | 'cancelled' | 'rescheduled' | 'no_show';

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
}

export class InterviewModel extends Model<
  InferAttributes<InterviewModel>,
  InferCreationAttributes<InterviewModel>
> {
  declare id: string;
  declare applicationId: string;
  declare type: InterviewType;
  declare status: InterviewStatus;
  declare scheduledAt: Date;
  declare durationMinutes: CreationOptional<number | null>;
  declare location: CreationOptional<string | null>;
  declare meetingUrl: CreationOptional<string | null>;
  declare notes: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare deletedAt: CreationOptional<Date | null>;

  static initialize(sequelize: Sequelize): void {
    InterviewModel.init(
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
        type: {
          type: DataTypes.STRING(40),
          allowNull: false,
        },
        status: {
          type: DataTypes.STRING(40),
          allowNull: false,
        },
        scheduledAt: {
          type: DataTypes.DATE,
          allowNull: false,
          field: 'scheduled_at',
        },
        durationMinutes: {
          type: DataTypes.INTEGER,
          allowNull: true,
          field: 'duration_minutes',
        },
        location: {
          type: DataTypes.STRING(160),
          allowNull: true,
          set(value: string | null | undefined) {
            this.setDataValue('location', normalizeOptionalText(value));
          },
        },
        meetingUrl: {
          type: DataTypes.STRING(2048),
          allowNull: true,
          field: 'meeting_url',
          set(value: string | null | undefined) {
            this.setDataValue('meetingUrl', normalizeOptionalText(value));
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
        tableName: 'interviews',
        underscored: true,
        paranoid: true,
      },
    );
  }
}
