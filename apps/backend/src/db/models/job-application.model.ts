import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize';

export type JobApplicationStatus =
  | 'draft'
  | 'applied'
  | 'screening'
  | 'interviewing'
  | 'offer'
  | 'rejected'
  | 'withdrawn'
  | 'accepted';

export type JobApplicationPriority = 'low' | 'medium' | 'high';

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
}

function normalizeOptionalCurrency(value: string | null | undefined): string | null {
  const normalizedValue = normalizeOptionalText(value);

  return normalizedValue ? normalizedValue.toUpperCase() : null;
}

export class JobApplicationModel extends Model<
  InferAttributes<JobApplicationModel>,
  InferCreationAttributes<JobApplicationModel>
> {
  declare id: string;
  declare userId: string;
  declare companyId: string;
  declare contactId: CreationOptional<string | null>;
  declare jobTitle: string;
  declare jobUrl: CreationOptional<string | null>;
  declare source: CreationOptional<string | null>;
  declare status: CreationOptional<JobApplicationStatus>;
  declare priority: CreationOptional<JobApplicationPriority>;
  declare salaryMin: CreationOptional<number | null>;
  declare salaryMax: CreationOptional<number | null>;
  declare salaryCurrency: CreationOptional<string | null>;
  declare location: CreationOptional<string | null>;
  declare employmentType: CreationOptional<string | null>;
  declare workMode: CreationOptional<string | null>;
  declare appliedAt: CreationOptional<string | null>;
  declare notes: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare deletedAt: CreationOptional<Date | null>;

  static initialize(sequelize: Sequelize): void {
    JobApplicationModel.init(
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
        companyId: {
          type: DataTypes.UUID,
          allowNull: false,
          field: 'company_id',
        },
        contactId: {
          type: DataTypes.UUID,
          allowNull: true,
          field: 'contact_id',
        },
        jobTitle: {
          type: DataTypes.STRING(160),
          allowNull: false,
          field: 'job_title',
          set(value: string) {
            this.setDataValue('jobTitle', value.trim());
          },
        },
        jobUrl: {
          type: DataTypes.STRING(2048),
          allowNull: true,
          field: 'job_url',
          set(value: string | null | undefined) {
            this.setDataValue('jobUrl', normalizeOptionalText(value));
          },
        },
        source: {
          type: DataTypes.STRING(120),
          allowNull: true,
          set(value: string | null | undefined) {
            this.setDataValue('source', normalizeOptionalText(value));
          },
        },
        status: {
          type: DataTypes.STRING(40),
          allowNull: false,
          defaultValue: 'draft',
        },
        priority: {
          type: DataTypes.STRING(20),
          allowNull: false,
          defaultValue: 'medium',
        },
        salaryMin: {
          type: DataTypes.INTEGER,
          allowNull: true,
          field: 'salary_min',
        },
        salaryMax: {
          type: DataTypes.INTEGER,
          allowNull: true,
          field: 'salary_max',
        },
        salaryCurrency: {
          type: DataTypes.CHAR(3),
          allowNull: true,
          field: 'salary_currency',
          set(value: string | null | undefined) {
            this.setDataValue('salaryCurrency', normalizeOptionalCurrency(value));
          },
        },
        location: {
          type: DataTypes.STRING(160),
          allowNull: true,
          set(value: string | null | undefined) {
            this.setDataValue('location', normalizeOptionalText(value));
          },
        },
        employmentType: {
          type: DataTypes.STRING(80),
          allowNull: true,
          field: 'employment_type',
          set(value: string | null | undefined) {
            this.setDataValue('employmentType', normalizeOptionalText(value));
          },
        },
        workMode: {
          type: DataTypes.STRING(80),
          allowNull: true,
          field: 'work_mode',
          set(value: string | null | undefined) {
            this.setDataValue('workMode', normalizeOptionalText(value));
          },
        },
        appliedAt: {
          type: DataTypes.DATEONLY,
          allowNull: true,
          field: 'applied_at',
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
        tableName: 'job_applications',
        underscored: true,
        paranoid: true,
      },
    );
  }
}
