import { DataTypes, Op, QueryInterface } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.addColumn(
      'resumes',
      'cleanup_due_at',
      {
        type: DataTypes.DATE,
        allowNull: true,
      },
      { transaction },
    );
    // Previously deleted resumes were inaccessible but retained their files and text.
    await queryInterface.sequelize.query(
      'UPDATE resumes SET extracted_text = NULL, cleanup_due_at = now() WHERE deleted_at IS NOT NULL',
      { transaction, logging: false },
    );
    await queryInterface.addIndex('resumes', ['cleanup_due_at', 'id'], {
      name: 'resumes_pending_cleanup_idx',
      where: { deleted_at: { [Op.ne]: null }, cleanup_due_at: { [Op.ne]: null } },
      transaction,
    });
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.removeIndex('resumes', 'resumes_pending_cleanup_idx', { transaction });
    await queryInterface.removeColumn('resumes', 'cleanup_due_at', { transaction });
  });
}
