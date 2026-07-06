import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize';

import { JobApplicationStatus } from './job-application.model.js';

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
}

export class ApplicationStatusHistoryModel extends Model<
  InferAttributes<ApplicationStatusHistoryModel>,
  InferCreationAttributes<ApplicationStatusHistoryModel>
> {
  declare id: string;
  declare applicationId: string;
  declare fromStatus: CreationOptional<JobApplicationStatus | null>;
  declare toStatus: JobApplicationStatus;
  declare changedAt: Date;
  declare note: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  static initialize(sequelize: Sequelize): void {
    ApplicationStatusHistoryModel.init(
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
        fromStatus: {
          type: DataTypes.STRING(40),
          allowNull: true,
          field: 'from_status',
        },
        toStatus: {
          type: DataTypes.STRING(40),
          allowNull: false,
          field: 'to_status',
        },
        changedAt: {
          type: DataTypes.DATE,
          allowNull: false,
          field: 'changed_at',
        },
        note: {
          type: DataTypes.TEXT,
          allowNull: true,
          set(value: string | null | undefined) {
            this.setDataValue('note', normalizeOptionalText(value));
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
      },
      {
        sequelize,
        tableName: 'application_status_history',
        underscored: true,
      },
    );
  }
}
