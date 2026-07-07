import { Sequelize } from 'sequelize';

import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { ApplicationStatusHistoryModel } from './models/application-status-history.model.js';
import { CompanyModel } from './models/company.model.js';
import { ContactModel } from './models/contact.model.js';
import { JobApplicationModel } from './models/job-application.model.js';
import { RefreshTokenModel } from './models/refresh-token.model.js';
import { UserModel } from './models/user.model.js';

export const sequelize = new Sequelize(env.DATABASE_URL, {
  dialect: 'postgres',
  logging: (message) => logger.debug({ sql: message }, 'sequelize query'),
});

UserModel.initialize(sequelize);
RefreshTokenModel.initialize(sequelize);
CompanyModel.initialize(sequelize);
ContactModel.initialize(sequelize);
JobApplicationModel.initialize(sequelize);
ApplicationStatusHistoryModel.initialize(sequelize);

UserModel.hasMany(RefreshTokenModel, {
  foreignKey: 'userId',
  as: 'refreshTokens',
});

RefreshTokenModel.belongsTo(UserModel, {
  foreignKey: 'userId',
  as: 'user',
});

RefreshTokenModel.belongsTo(RefreshTokenModel, {
  foreignKey: 'replacedByTokenId',
  as: 'replacementToken',
});

UserModel.hasMany(CompanyModel, {
  foreignKey: 'userId',
  as: 'companies',
});

CompanyModel.belongsTo(UserModel, {
  foreignKey: 'userId',
  as: 'user',
});

CompanyModel.hasMany(ContactModel, {
  foreignKey: 'companyId',
  as: 'contacts',
});

ContactModel.belongsTo(CompanyModel, {
  foreignKey: 'companyId',
  as: 'company',
});

UserModel.hasMany(JobApplicationModel, {
  foreignKey: 'userId',
  as: 'jobApplications',
});

JobApplicationModel.belongsTo(UserModel, {
  foreignKey: 'userId',
  as: 'user',
});

CompanyModel.hasMany(JobApplicationModel, {
  foreignKey: 'companyId',
  as: 'jobApplications',
});

JobApplicationModel.belongsTo(CompanyModel, {
  foreignKey: 'companyId',
  as: 'company',
});

ContactModel.hasMany(JobApplicationModel, {
  foreignKey: 'contactId',
  as: 'jobApplications',
});

JobApplicationModel.belongsTo(ContactModel, {
  foreignKey: 'contactId',
  as: 'contact',
});

JobApplicationModel.hasMany(ApplicationStatusHistoryModel, {
  foreignKey: 'applicationId',
  as: 'statusHistory',
});

ApplicationStatusHistoryModel.belongsTo(JobApplicationModel, {
  foreignKey: 'applicationId',
  as: 'application',
});
