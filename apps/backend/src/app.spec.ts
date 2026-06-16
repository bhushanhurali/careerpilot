import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from './app.js';
import { ApiResponse } from './shared/responses/api-response.js';

describe('CareerPilot API foundation', () => {
  it('returns simple infrastructure health', async () => {
    const response = await request(createApp()).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('returns enveloped API health', async () => {
    const response = await request(createApp()).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: { status: 'ok' },
      error: null,
      meta: {},
    });
  });

  it('returns standard not found responses', async () => {
    const response = await request(createApp()).get('/missing');
    const body = response.body as ApiResponse<never>;

    expect(response.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe('NOT_FOUND');
  });
});
