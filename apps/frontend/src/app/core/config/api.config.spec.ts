import { API_BASE_URL } from './api.config';
import { API_BASE_URL as PRODUCTION_API_BASE_URL } from './api.config.production';

describe('API base URL configuration', () => {
  it('uses localhost in the default test and development configuration', () => {
    expect(API_BASE_URL).toBe('http://localhost:3000/api/v1');
  });

  it('uses the HTTPS JobThreader API in production', () => {
    expect(PRODUCTION_API_BASE_URL).toBe('https://api.jobthreader.com/api/v1');
  });
});
