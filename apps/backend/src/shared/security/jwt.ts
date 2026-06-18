import crypto from 'node:crypto';

import jwt, { JwtPayload } from 'jsonwebtoken';

import { env } from '../../config/env.js';
import { UserRole } from '../../db/models/user.model.js';

const accessTokenType = 'access';
const refreshTokenType = 'refresh';

export type AccessTokenPayload = {
  sub: string;
  role: UserRole;
  type: typeof accessTokenType;
};

export type RefreshTokenPayload = {
  sub: string;
  jti: string;
  familyId: string;
  type: typeof refreshTokenType;
};

function assertJwtPayload(payload: string | JwtPayload): asserts payload is JwtPayload {
  if (typeof payload === 'string') {
    throw new Error('JWT payload must be an object');
  }
}

export function signAccessToken(user: { id: string; role: UserRole }): string {
  const payload: AccessTokenPayload = {
    sub: user.id,
    role: user.role,
    type: accessTokenType,
  };

  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
  assertJwtPayload(payload);
  const payloadRecord = payload as Record<string, unknown>;

  const subject = typeof payloadRecord.sub === 'string' ? payloadRecord.sub : null;
  const role =
    payloadRecord.role === 'user' || payloadRecord.role === 'admin' ? payloadRecord.role : null;

  if (payloadRecord.type !== accessTokenType || !subject) {
    throw new Error('Invalid access token payload');
  }

  if (!role) {
    throw new Error('Invalid access token role');
  }

  return {
    sub: subject,
    role,
    type: accessTokenType,
  };
}

export function signRefreshToken(input: { userId: string; tokenId?: string; familyId?: string }): {
  token: string;
  tokenId: string;
  familyId: string;
  expiresAt: Date;
} {
  const tokenId = input.tokenId ?? crypto.randomUUID();
  const familyId = input.familyId ?? crypto.randomUUID();
  const now = Date.now();
  const expiresAt = new Date(now + env.REFRESH_TOKEN_TTL_SECONDS * 1000);
  const payload: RefreshTokenPayload = {
    sub: input.userId,
    jti: tokenId,
    familyId,
    type: refreshTokenType,
  };

  return {
    token: jwt.sign(payload, env.JWT_REFRESH_SECRET, {
      expiresIn: env.REFRESH_TOKEN_TTL_SECONDS,
    }),
    tokenId,
    familyId,
    expiresAt,
  };
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const payload = jwt.verify(token, env.JWT_REFRESH_SECRET);
  assertJwtPayload(payload);
  const payloadRecord = payload as Record<string, unknown>;

  const subject = typeof payloadRecord.sub === 'string' ? payloadRecord.sub : null;
  const jwtId = typeof payloadRecord.jti === 'string' ? payloadRecord.jti : null;
  const familyId = typeof payloadRecord.familyId === 'string' ? payloadRecord.familyId : null;

  if (payloadRecord.type !== refreshTokenType || !subject || !jwtId || !familyId) {
    throw new Error('Invalid refresh token payload');
  }

  return {
    sub: subject,
    jti: jwtId,
    familyId,
    type: refreshTokenType,
  };
}
