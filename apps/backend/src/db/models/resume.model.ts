import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize';

export const resumeMimeTypes = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

export type ResumeMimeType = (typeof resumeMimeTypes)[number];

export class ResumeModel extends Model<
  InferAttributes<ResumeModel>,
  InferCreationAttributes<ResumeModel>
> {
  declare id: string;
  declare userId: string;
  declare title: string;
  declare originalFilename: string;
  declare mimeType: ResumeMimeType;
  declare fileSizeBytes: number;
  declare storageKey: string;
  declare extractedText: CreationOptional<string | null>;
  declare cleanupDueAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare deletedAt: CreationOptional<Date | null>;

  static initialize(sequelize: Sequelize): void {
    ResumeModel.init(
      {
        id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
        userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
        title: {
          type: DataTypes.STRING(160),
          allowNull: false,
          set(value: string) {
            this.setDataValue('title', value.trim());
          },
        },
        originalFilename: {
          type: DataTypes.STRING(255),
          allowNull: false,
          field: 'original_filename',
        },
        mimeType: { type: DataTypes.STRING(127), allowNull: false, field: 'mime_type' },
        fileSizeBytes: { type: DataTypes.INTEGER, allowNull: false, field: 'file_size_bytes' },
        storageKey: { type: DataTypes.UUID, allowNull: false, field: 'storage_key' },
        extractedText: { type: DataTypes.TEXT, allowNull: true, field: 'extracted_text' },
        cleanupDueAt: { type: DataTypes.DATE, allowNull: true, field: 'cleanup_due_at' },
        createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
        updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
        deletedAt: { type: DataTypes.DATE, allowNull: true, field: 'deleted_at' },
      },
      { sequelize, tableName: 'resumes', underscored: true, paranoid: true },
    );
  }
}
