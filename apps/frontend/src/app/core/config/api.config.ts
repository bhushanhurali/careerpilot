type ImportMetaWithEnv = ImportMeta & {
  readonly env?: Record<string, string | undefined>;
};

const configuredApiBaseUrl = (import.meta as ImportMetaWithEnv).env?.['NG_APP_API_BASE_URL'];

export const API_BASE_URL = (configuredApiBaseUrl ?? 'http://localhost:3000/api/v1').replace(
  /\/$/,
  '',
);
