export type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  createdAt: string;
  updatedAt: string;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type RegisterRequest = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
};

export type AuthTokenResponse = {
  accessToken: string;
};

export type AuthSessionResponse = AuthTokenResponse & {
  user: AuthUser;
};

export type CurrentUserResponse = {
  user: AuthUser;
};

export type ApiErrorResponse = {
  code: string;
  message: string;
  details?: unknown;
};

export type ApiResponse<T> = {
  success: boolean;
  data: T | null;
  error: ApiErrorResponse | null;
  meta: Record<string, unknown>;
};

export type AuthStatus = 'unknown' | 'authenticated' | 'anonymous';
