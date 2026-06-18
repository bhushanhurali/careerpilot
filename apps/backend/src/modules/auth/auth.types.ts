import { UserRole } from '../../db/models/user.model.js';

export type AuthUserDto = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
};

export type AuthTokenResponse = {
  user: AuthUserDto;
  accessToken: string;
  refreshToken: string;
};

export type RefreshResponse = {
  accessToken: string;
  refreshToken: string;
};

export type RegisterInput = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type UserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
};

export type RefreshTokenRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedByTokenId: string | null;
};
