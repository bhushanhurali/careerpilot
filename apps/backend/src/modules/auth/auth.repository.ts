import crypto from 'node:crypto';

import { Op, Transaction } from 'sequelize';

import { sequelize } from '../../db/sequelize.js';
import { RefreshTokenModel } from '../../db/models/refresh-token.model.js';
import { UserModel } from '../../db/models/user.model.js';
import { RefreshTokenRecord, UserRecord } from './auth.types.js';

export type TransactionContext = unknown;

export type CreateUserInput = {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
};

export type CreateRefreshTokenInput = {
  id: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
};

export type AuthRepository = {
  transaction<T>(callback: (transaction: TransactionContext) => Promise<T>): Promise<T>;
  createUser(input: CreateUserInput, transaction?: TransactionContext): Promise<UserRecord>;
  findUserByEmail(email: string): Promise<UserRecord | null>;
  findUserById(id: string): Promise<UserRecord | null>;
  createRefreshToken(
    input: CreateRefreshTokenInput,
    transaction?: TransactionContext,
  ): Promise<RefreshTokenRecord>;
  findRefreshTokenByHash(
    tokenHash: string,
    transaction?: TransactionContext,
  ): Promise<RefreshTokenRecord | null>;
  revokeRefreshToken(
    id: string,
    replacedByTokenId: string | null,
    transaction?: TransactionContext,
  ): Promise<void>;
  revokeRefreshTokenFamily(familyId: string, transaction?: TransactionContext): Promise<void>;
};

function toUserRecord(user: UserModel): UserRecord {
  return {
    id: user.id,
    email: user.email,
    passwordHash: user.passwordHash,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    isActive: user.isActive,
  };
}

function toRefreshTokenRecord(refreshToken: RefreshTokenModel): RefreshTokenRecord {
  return {
    id: refreshToken.id,
    userId: refreshToken.userId,
    tokenHash: refreshToken.tokenHash,
    familyId: refreshToken.familyId,
    expiresAt: refreshToken.expiresAt,
    revokedAt: refreshToken.revokedAt ?? null,
    replacedByTokenId: refreshToken.replacedByTokenId ?? null,
  };
}

function asSequelizeTransaction(transaction?: TransactionContext): Transaction | undefined {
  return transaction instanceof Transaction ? transaction : undefined;
}

function withTransaction(
  transaction?: TransactionContext,
): { transaction: Transaction } | undefined {
  const sequelizeTransaction = asSequelizeTransaction(transaction);

  return sequelizeTransaction ? { transaction: sequelizeTransaction } : undefined;
}

export class SequelizeAuthRepository implements AuthRepository {
  async transaction<T>(callback: (transaction: TransactionContext) => Promise<T>): Promise<T> {
    return sequelize.transaction((transaction) => callback(transaction));
  }

  async createUser(input: CreateUserInput, transaction?: TransactionContext): Promise<UserRecord> {
    const user = await UserModel.create(
      {
        id: crypto.randomUUID(),
        email: input.email,
        passwordHash: input.passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
      },
      withTransaction(transaction),
    );

    return toUserRecord(user);
  }

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const user = await UserModel.findOne({
      where: sequelize.where(sequelize.fn('lower', sequelize.col('email')), email.toLowerCase()),
    });

    return user ? toUserRecord(user) : null;
  }

  async findUserById(id: string): Promise<UserRecord | null> {
    const user = await UserModel.findByPk(id);

    return user ? toUserRecord(user) : null;
  }

  async createRefreshToken(
    input: CreateRefreshTokenInput,
    transaction?: TransactionContext,
  ): Promise<RefreshTokenRecord> {
    const refreshToken = await RefreshTokenModel.create(
      {
        id: input.id,
        userId: input.userId,
        tokenHash: input.tokenHash,
        familyId: input.familyId,
        expiresAt: input.expiresAt,
      },
      withTransaction(transaction),
    );

    return toRefreshTokenRecord(refreshToken);
  }

  async findRefreshTokenByHash(
    tokenHash: string,
    transaction?: TransactionContext,
  ): Promise<RefreshTokenRecord | null> {
    const refreshToken = await RefreshTokenModel.findOne({
      where: {
        tokenHash,
      },
      ...withTransaction(transaction),
    });

    return refreshToken ? toRefreshTokenRecord(refreshToken) : null;
  }

  async revokeRefreshToken(
    id: string,
    replacedByTokenId: string | null,
    transaction?: TransactionContext,
  ): Promise<void> {
    await RefreshTokenModel.update(
      {
        revokedAt: new Date(),
        replacedByTokenId,
      },
      {
        where: {
          id,
          revokedAt: {
            [Op.is]: null,
          },
        },
        ...withTransaction(transaction),
      },
    );
  }

  async revokeRefreshTokenFamily(
    familyId: string,
    transaction?: TransactionContext,
  ): Promise<void> {
    await RefreshTokenModel.update(
      {
        revokedAt: new Date(),
      },
      {
        where: {
          familyId,
          revokedAt: {
            [Op.is]: null,
          },
        },
        ...withTransaction(transaction),
      },
    );
  }
}
