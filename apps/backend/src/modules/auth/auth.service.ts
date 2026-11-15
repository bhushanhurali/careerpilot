import jwt from 'jsonwebtoken';

import { HttpError } from '../../shared/errors/http-error.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../../shared/security/jwt.js';
import { hashPassword, verifyPassword } from '../../shared/security/password.js';
import { hashToken } from '../../shared/security/token-hash.js';
import { AuthRepository, CreateUserInput } from './auth.repository.js';
import {
  AuthTokenResponse,
  AuthUserDto,
  LoginInput,
  RefreshResponse,
  RegisterInput,
  UserRecord,
} from './auth.types.js';

function toUserDto(user: UserRecord): AuthUserDto {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
  };
}

function invalidCredentialsError(): HttpError {
  return new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
}

function invalidRefreshTokenError(): HttpError {
  return new HttpError(401, 'REFRESH_TOKEN_INVALID', 'Refresh token is invalid');
}

export class AuthService {
  constructor(private readonly authRepository: AuthRepository) {}

  private async prepareNewUser(input: RegisterInput): Promise<CreateUserInput> {
    const existingUser = await this.authRepository.findUserByEmail(input.email);

    if (existingUser) {
      throw new HttpError(409, 'EMAIL_ALREADY_EXISTS', 'A user with this email already exists');
    }

    const passwordHash = await hashPassword(input.password);
    return {
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
    };
  }

  async provisionAccount(input: RegisterInput): Promise<void> {
    const user = await this.prepareNewUser(input);
    await this.authRepository.createUser(user);
  }

  async register(input: RegisterInput): Promise<AuthTokenResponse> {
    const newUser = await this.prepareNewUser(input);
    return this.authRepository.transaction(async (transaction) => {
      const user = await this.authRepository.createUser(newUser, transaction);
      const refreshToken = signRefreshToken({ userId: user.id });
      const accessToken = signAccessToken({ id: user.id, role: user.role });

      await this.authRepository.createRefreshToken(
        {
          id: refreshToken.tokenId,
          userId: user.id,
          tokenHash: hashToken(refreshToken.token),
          familyId: refreshToken.familyId,
          expiresAt: refreshToken.expiresAt,
        },
        transaction,
      );

      return {
        user: toUserDto(user),
        accessToken,
        refreshToken: refreshToken.token,
      };
    });
  }

  async login(input: LoginInput): Promise<AuthTokenResponse> {
    const user = await this.authRepository.findUserByEmail(input.email);

    if (!user?.isActive) {
      throw invalidCredentialsError();
    }

    const passwordMatches = await verifyPassword(input.password, user.passwordHash);

    if (!passwordMatches) {
      throw invalidCredentialsError();
    }

    return this.authRepository.transaction(async (transaction) => {
      const refreshToken = signRefreshToken({ userId: user.id });
      const accessToken = signAccessToken({ id: user.id, role: user.role });

      await this.authRepository.createRefreshToken(
        {
          id: refreshToken.tokenId,
          userId: user.id,
          tokenHash: hashToken(refreshToken.token),
          familyId: refreshToken.familyId,
          expiresAt: refreshToken.expiresAt,
        },
        transaction,
      );

      return {
        user: toUserDto(user),
        accessToken,
        refreshToken: refreshToken.token,
      };
    });
  }

  async refresh(rawRefreshToken: string | undefined): Promise<RefreshResponse> {
    if (!rawRefreshToken) {
      throw invalidRefreshTokenError();
    }

    let payload: ReturnType<typeof verifyRefreshToken>;

    try {
      payload = verifyRefreshToken(rawRefreshToken);
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
        throw invalidRefreshTokenError();
      }
      throw error;
    }

    return this.authRepository.transaction(async (transaction) => {
      const existingToken = await this.authRepository.findRefreshTokenByHash(
        hashToken(rawRefreshToken),
        transaction,
      );

      if (!existingToken) {
        throw invalidRefreshTokenError();
      }

      if (existingToken.revokedAt) {
        await this.authRepository.revokeRefreshTokenFamily(existingToken.familyId, transaction);
        throw new HttpError(401, 'REFRESH_TOKEN_REVOKED', 'Refresh token has been revoked');
      }

      if (existingToken.expiresAt.getTime() <= Date.now()) {
        await this.authRepository.revokeRefreshToken(existingToken.id, null, transaction);
        throw invalidRefreshTokenError();
      }

      const user = await this.authRepository.findUserById(payload.sub);

      if (!user || !user.isActive || user.id !== existingToken.userId) {
        throw invalidRefreshTokenError();
      }

      const nextRefreshToken = signRefreshToken({
        userId: user.id,
        familyId: existingToken.familyId,
      });
      const accessToken = signAccessToken({ id: user.id, role: user.role });

      await this.authRepository.createRefreshToken(
        {
          id: nextRefreshToken.tokenId,
          userId: user.id,
          tokenHash: hashToken(nextRefreshToken.token),
          familyId: nextRefreshToken.familyId,
          expiresAt: nextRefreshToken.expiresAt,
        },
        transaction,
      );
      await this.authRepository.revokeRefreshToken(
        existingToken.id,
        nextRefreshToken.tokenId,
        transaction,
      );

      return {
        accessToken,
        refreshToken: nextRefreshToken.token,
      };
    });
  }

  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (!rawRefreshToken) {
      return;
    }

    await this.authRepository.transaction(async (transaction) => {
      const existingToken = await this.authRepository.findRefreshTokenByHash(
        hashToken(rawRefreshToken),
        transaction,
      );

      if (existingToken && !existingToken.revokedAt) {
        await this.authRepository.revokeRefreshToken(existingToken.id, null, transaction);
      }
    });
  }

  async getCurrentUser(userId: string): Promise<AuthUserDto> {
    const user = await this.authRepository.findUserById(userId);

    if (!user?.isActive) {
      throw new HttpError(401, 'AUTH_USER_NOT_FOUND', 'Authenticated user no longer exists');
    }

    return toUserDto(user);
  }
}
