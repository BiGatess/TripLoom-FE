export type DataSourceMode = 'mock' | 'api';

export interface AppEnv {
  dataSource: DataSourceMode;
  apiBaseUrl: string;
  csrfCookieName: string;
  csrfHeaderName: string;
  enableDevTools: boolean;
  isDev: boolean;
}

function readEnvValue(key: string): string | undefined {
  try {
    const metaEnv = (import.meta as unknown as { env?: Record<string, string | boolean | undefined> }).env;
    const val = metaEnv?.[key];
    return typeof val === 'string' ? val : undefined;
  } catch {
    return undefined;
  }
}

function readIsDev(): boolean {
  try {
    const metaEnv = (import.meta as unknown as { env?: Record<string, unknown> }).env;
    return Boolean(metaEnv?.DEV);
  } catch {
    return true;
  }
}

const rawMode = (readEnvValue('VITE_DATA_SOURCE') ?? 'mock').toLowerCase();
const dataSource: DataSourceMode = rawMode === 'api' ? 'api' : 'mock';
const isDev = readIsDev();
const rawDevTools = readEnvValue('VITE_ENABLE_DEV_TOOLS');

export const appEnv: AppEnv = {
  dataSource,
  apiBaseUrl: (readEnvValue('VITE_API_BASE_URL') ?? 'http://localhost:8000/api/v1').replace(/\/+$/, ''),
  csrfCookieName: readEnvValue('VITE_CSRF_COOKIE_NAME') ?? 'csrftoken',
  csrfHeaderName: readEnvValue('VITE_CSRF_HEADER_NAME') ?? 'X-CSRFToken',
  enableDevTools: dataSource === 'mock' && (rawDevTools === 'true' || (rawDevTools === undefined && isDev)),
  isDev,
};
