import crypto from 'node:crypto';

import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../app.js';
import { createMigrator } from '../../db/migrator.js';
import { CompanyModel } from '../../db/models/company.model.js';
import { ContactModel } from '../../db/models/contact.model.js';
import { UserModel } from '../../db/models/user.model.js';
import { sequelize } from '../../db/sequelize.js';
import { ApiResponse } from '../../shared/responses/api-response.js';
import { signAccessToken } from '../../shared/security/jwt.js';
import { CompanyDto } from './companies.types.js';

type CompanyResponse = {
  company: CompanyDto;
};

type CompaniesResponse = {
  companies: CompanyDto[];
};

function assertTestDatabase(): void {
  if (process.env.NODE_ENV !== 'test' || !process.env.DATABASE_URL?.includes('careerpilot_test')) {
    throw new Error('Company integration tests must run against the test database');
  }
}

async function truncateBusinessTables(): Promise<void> {
  await sequelize.query(
    'TRUNCATE TABLE contacts, companies, refresh_tokens, users RESTART IDENTITY CASCADE;',
  );
}

async function createTestUser(email: string): Promise<{ id: string; accessToken: string }> {
  const id = crypto.randomUUID();

  await UserModel.create({
    id,
    email,
    passwordHash: 'test-password-hash',
    firstName: 'Test',
    lastName: 'User',
  });

  return {
    id,
    accessToken: signAccessToken({ id, role: 'user' }),
  };
}

async function createCompany(userId: string, name: string, overrides: Partial<CompanyModel> = {}) {
  return CompanyModel.create({
    id: crypto.randomUUID(),
    userId,
    name,
    website: null,
    industry: null,
    location: null,
    notes: null,
    ...overrides,
  });
}

function authorize(accessToken: string): { Authorization: string } {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

describe('companies API', () => {
  const app = createApp({ disableRateLimits: true });

  beforeAll(async () => {
    assertTestDatabase();
    await createMigrator().up();
  });

  beforeEach(async () => {
    await truncateBusinessTables();
  });

  it('requires authentication for company routes', async () => {
    const response = await request(app).get('/api/v1/companies');
    const body = response.body as ApiResponse<never>;

    expect(response.status).toBe(401);
    expect(body.error?.code).toBe('AUTH_TOKEN_MISSING');
  });

  it('creates an owned company and trims the company name', async () => {
    const user = await createTestUser('owner@example.com');

    const response = await request(app)
      .post('/api/v1/companies')
      .set(authorize(user.accessToken))
      .send({
        name: '  Acme GmbH  ',
        website: 'https://acme.example',
        industry: 'Software',
        location: 'Berlin',
        notes: 'Interesting hiring team',
      });
    const body = response.body as ApiResponse<CompanyResponse>;
    const storedCompany = await CompanyModel.findByPk(body.data?.company.id);

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data?.company.name).toBe('Acme GmbH');
    expect(storedCompany?.userId).toBe(user.id);
  });

  it('rejects request body fields that clients must not control', async () => {
    const user = await createTestUser('owner@example.com');

    const response = await request(app)
      .post('/api/v1/companies')
      .set(authorize(user.accessToken))
      .send({
        id: crypto.randomUUID(),
        userId: crypto.randomUUID(),
        name: 'Acme GmbH',
      });
    const body = response.body as ApiResponse<never>;

    expect(response.status).toBe(400);
    expect(body.error?.code).toBe('VALIDATION_ERROR');
  });

  it('returns 409 for duplicate active company names owned by the same user', async () => {
    const user = await createTestUser('owner@example.com');

    await request(app).post('/api/v1/companies').set(authorize(user.accessToken)).send({
      name: 'Acme GmbH',
    });

    const response = await request(app)
      .post('/api/v1/companies')
      .set(authorize(user.accessToken))
      .send({
        name: '  acme gmbh  ',
      });
    const body = response.body as ApiResponse<never>;

    expect(response.status).toBe(409);
    expect(body.error?.code).toBe('COMPANY_NAME_ALREADY_EXISTS');
  });

  it('allows different users to use the same company name', async () => {
    const firstUser = await createTestUser('first@example.com');
    const secondUser = await createTestUser('second@example.com');

    await request(app).post('/api/v1/companies').set(authorize(firstUser.accessToken)).send({
      name: 'Acme GmbH',
    });

    const response = await request(app)
      .post('/api/v1/companies')
      .set(authorize(secondUser.accessToken))
      .send({
        name: 'acme gmbh',
      });

    expect(response.status).toBe(201);
  });

  it('lists only the authenticated user companies with search, filters, pagination, and deterministic sorting', async () => {
    const user = await createTestUser('owner@example.com');
    const otherUser = await createTestUser('other@example.com');

    await createCompany(user.id, 'Acme GmbH', {
      industry: 'Software',
      location: 'Berlin',
    });
    await createCompany(user.id, 'Acme Labs', {
      industry: 'Software',
      location: 'Berlin',
    });
    await createCompany(user.id, 'Beta AG', {
      industry: 'Software',
      location: 'Berlin',
    });
    await createCompany(otherUser.id, 'Acme Other', {
      industry: 'Software',
      location: 'Berlin',
    });

    const response = await request(app)
      .get('/api/v1/companies')
      .query({
        search: 'acme',
        industry: 'software',
        location: 'berlin',
        sortBy: 'name',
        sortDirection: 'desc',
        page: 1,
        pageSize: 1,
      })
      .set(authorize(user.accessToken));
    const body = response.body as ApiResponse<CompaniesResponse>;

    expect(response.status).toBe(200);
    expect(body.data?.companies).toHaveLength(1);
    expect(body.data?.companies[0]?.name).toBe('Acme Labs');
    expect(body.meta).toEqual({
      page: 1,
      pageSize: 1,
      total: 2,
      totalPages: 2,
    });
  });

  it('returns owned company details and conceals cross-user companies as not found', async () => {
    const owner = await createTestUser('owner@example.com');
    const otherUser = await createTestUser('other@example.com');
    const company = await createCompany(owner.id, 'Acme GmbH');

    const ownedResponse = await request(app)
      .get(`/api/v1/companies/${company.id}`)
      .set(authorize(owner.accessToken));
    const crossUserResponse = await request(app)
      .get(`/api/v1/companies/${company.id}`)
      .set(authorize(otherUser.accessToken));
    const crossUserBody = crossUserResponse.body as ApiResponse<never>;

    expect(ownedResponse.status).toBe(200);
    expect(crossUserResponse.status).toBe(404);
    expect(crossUserBody.error?.code).toBe('COMPANY_NOT_FOUND');
  });

  it('updates only owned companies and rejects duplicate names', async () => {
    const owner = await createTestUser('owner@example.com');
    const otherUser = await createTestUser('other@example.com');
    const company = await createCompany(owner.id, 'Acme GmbH');

    await createCompany(owner.id, 'Beta AG');

    const crossUserResponse = await request(app)
      .patch(`/api/v1/companies/${company.id}`)
      .set(authorize(otherUser.accessToken))
      .send({
        name: 'Hijacked Name',
      });

    const duplicateResponse = await request(app)
      .patch(`/api/v1/companies/${company.id}`)
      .set(authorize(owner.accessToken))
      .send({
        name: ' beta ag ',
      });

    const updateResponse = await request(app)
      .patch(`/api/v1/companies/${company.id}`)
      .set(authorize(owner.accessToken))
      .send({
        website: 'https://acme.example',
        location: 'Munich',
      });
    const updateBody = updateResponse.body as ApiResponse<CompanyResponse>;

    expect(crossUserResponse.status).toBe(404);
    expect(duplicateResponse.status).toBe(409);
    expect(updateResponse.status).toBe(200);
    expect(updateBody.data?.company.website).toBe('https://acme.example');
    expect(updateBody.data?.company.location).toBe('Munich');
  });

  it('soft-deletes an owned company and its active contacts in one transaction', async () => {
    const owner = await createTestUser('owner@example.com');
    const otherUser = await createTestUser('other@example.com');
    const company = await createCompany(owner.id, 'Acme GmbH');
    const activeContact = await ContactModel.create({
      id: crypto.randomUUID(),
      companyId: company.id,
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      phone: null,
      roleTitle: 'Recruiter',
      linkedInUrl: null,
      notes: null,
    });
    const alreadyDeletedContact = await ContactModel.create({
      id: crypto.randomUUID(),
      companyId: company.id,
      firstName: 'Grace',
      lastName: 'Hopper',
      email: 'grace@example.com',
      phone: null,
      roleTitle: 'Manager',
      linkedInUrl: null,
      notes: null,
    });

    await alreadyDeletedContact.destroy();

    const crossUserResponse = await request(app)
      .delete(`/api/v1/companies/${company.id}`)
      .set(authorize(otherUser.accessToken));
    const deleteResponse = await request(app)
      .delete(`/api/v1/companies/${company.id}`)
      .set(authorize(owner.accessToken));
    const deletedCompany = await CompanyModel.findByPk(company.id, { paranoid: false });
    const deletedActiveContact = await ContactModel.findByPk(activeContact.id, { paranoid: false });
    const deletedInactiveContact = await ContactModel.findByPk(alreadyDeletedContact.id, {
      paranoid: false,
    });

    expect(crossUserResponse.status).toBe(404);
    expect(deleteResponse.status).toBe(200);
    expect(deletedCompany?.deletedAt).toBeInstanceOf(Date);
    expect(deletedActiveContact?.deletedAt).toBeInstanceOf(Date);
    expect(deletedInactiveContact?.deletedAt).toBeInstanceOf(Date);
  });
});
