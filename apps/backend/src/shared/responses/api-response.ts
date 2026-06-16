export type ApiError = {
  code: string;
  message: string;
  details?: unknown;
};

export type ApiResponse<TData> = {
  success: boolean;
  data: TData | null;
  error: ApiError | null;
  meta: Record<string, unknown>;
};

export function ok<TData>(data: TData, meta: Record<string, unknown> = {}): ApiResponse<TData> {
  return {
    success: true,
    data,
    error: null,
    meta,
  };
}

export function fail(error: ApiError, meta: Record<string, unknown> = {}): ApiResponse<never> {
  return {
    success: false,
    data: null,
    error,
    meta,
  };
}
