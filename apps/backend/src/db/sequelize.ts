import { Sequelize } from 'sequelize';

import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { RefreshTokenModel } from './models/refresh-token.model.js';
import { UserModel } from './models/user.model.js';

export const sequelize = new Sequelize(env.DATABASE_URL, {
  dialect: 'postgres',
  logging: (message) => logger.debug({ sql: message }, 'sequelize query'),
});

UserModel.initialize(sequelize);
RefreshTokenModel.initialize(sequelize);

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
