import crypto from 'node:crypto';

import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../app.js';
import { createMigrator } from '../../db/migrator.js';
import { CompanyModel } from '../../db/models/company.model.js';
import { ContactModel } from '../../db/models/contact.model.js';
import { JobApplicationModel } from '../../db/models/job-application.model.js';
import { UserModel } from '../../db/models/user.model.js';
import { sequelize } from '../../db/sequelize.js';
import { ApiResponse } from '../../shared/responses/api-response.js';
import { signAccessToken } from '../../shared/security/jwt.js';
import { JobApplicationDto } from './applications.types.js';

type ApplicationResponse = {
  application: JobApplicationDto;
};

type ApplicationsResponse = {
  applications: JobApplicationDto[];
};

function assertTestDatabase(): void {
  const databaseUrl = process.env.DATABASE_URL;
  const databaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';

  if (process.env.NODE_ENV !== 'test' || !databaseName.toLowerCase().includes('test')) {
    throw new Error('Application integration tests must run against a test database');
  }
}

async function truncateBusinessTables(): Promise<void> {
  await sequelize.query(
    'TRUNCATE TABLE job_applications, contacts, companies, refresh_tokens, users RESTART IDENTITY CASCADE;',
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

async function createCompany(userId: string, name: string) {
  return CompanyModel.create({
    id: crypto.randomUUID(),
    userId,
    name,
    website: null,
    industry: null,
    location: null,
    notes: null,
  });
}

async function createContact(companyId: string, firstName: string) {
  return ContactModel.create({
    id: crypto.randomUUID(),
    companyId,
    firstName,
    lastName: null,
    email: `${firstName.toLowerCase()}@example.com`,
    phone: null,
    roleTitle: 'Recruiter',
    linkedInUrl: null,
    notes: null,
  });
}

async function createApplication(
  userId: string,
  companyId: string,
  overrides: Partial<JobApplicationModel> = {},
) {
  return JobApplicationModel.create({
    id: crypto.randomUUID(),
    userId,
    companyId,
    contactId: null,
    jobTitle: 'Angular Developer',
    jobUrl: null,
    source: null,
    status: 'draft',
    priority: 'medium',
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    location: null,
    employmentType: null,
    workMode: null,
    appliedAt: null,
    notes: null,
    ...overrides,
  });
}

function authorize(accessToken: string): { Authorization: string } {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

function applicationUrl(applicationId: string): string {
  return `/api/v1/applications/${applicationId}`;
}

describe('applications API', () => {
  const app = createApp({ disableRateLimits: true });

  beforeAll(async () => {
    assertTestDatabase();
    await createMigrator().up();
  });

  beforeEach(async () => {
    await truncateBusinessTables();
  });

  it('requires authentication for every application endpoint', async () => {
    const applicationId = crypto.randomUUID();

    const responses = await Promise.all([
      request(app).get('/api/v1/applications'),
      request(app).post('/api/v1/applications').send({}),
      request(app).get(applicationUrl(applicationId)),
      request(app).patch(applicationUrl(applicationId)).send({ jobTitle: 'Changed' }),
      request(app).delete(applicationUrl(applicationId)),
    ]);

    for (const response of responses) {
      const body = response.body as ApiResponse<never>;

      expect(response.status).toBe(401);
      expect(body.error?.code).toBe('AUTH_TOKEN_MISSING');
    }
  });

  it('creates an application for an owned company and optional contact', async () => {
    const user = await createTestUser('owner@example.com');
    const company = await createCompany(user.id, 'Acme GmbH');
    const contact = await createContact(company.id, 'Ada');

    const response = await request(app)
      .post('/api/v1/applications')
      .set(authorize(user.accessToken))
      .send({
        companyId: company.id,
        contactId: contact.id,
        jobTitle: '  Senior Angular Developer  ',
        jobUrl: 'https://acme.example/jobs/angular',
        source: ' LinkedIn ',
        status: 'applied',
        priority: 'high',
        salaryMin: 65_000,
        salaryMax: 80_000,
        salaryCurrency: 'eur',
        location: ' Munich, Germany ',
        employmentType: 'full_time',
        workMode: 'hybrid',
        appliedAt: '2026-07-05',
        notes: ' Strong frontend role ',
      });
    const body = response.body as ApiResponse<ApplicationResponse>;

    expect(response.status).toBe(201);
    expect(body.data?.application.userId).toBe(user.id);
    expect(body.data?.application.company.id).toBe(company.id);
    expect(body.data?.application.contact?.id).toBe(contact.id);
    expect(body.data?.application.jobTitle).toBe('Senior Angular Developer');
    expect(body.data?.application.salaryCurrency).toBe('EUR');
    expect(body.data?.application.appliedAt).toBe('2026-07-05');
  });

  it('rejects invalid application payloads and client-controlled fields', async () => {
    const user = await createTestUser('owner@example.com');
    const company = await createCompany(user.id, 'Acme GmbH');

    const missingCompany = await request(app)
      .post('/api/v1/applications')
      .set(authorize(user.accessToken))
      .send({ jobTitle: 'Angular Developer' });
    const clientControlledFields = await request(app)
      .post('/api/v1/applications')
      .set(authorize(user.accessToken))
      .send({
        id: crypto.randomUUID(),
        userId: crypto.randomUUID(),
        companyId: company.id,
        jobTitle: 'Angular Developer',
      });
    const invalidStatus = await request(app)
      .post('/api/v1/applications')
      .set(authorize(user.accessToken))
      .send({ companyId: company.id, jobTitle: 'Angular Developer', status: 'sent' });
    const invalidSalaryRange = await request(app)
      .post('/api/v1/applications')
      .set(authorize(user.accessToken))
      .send({
        companyId: company.id,
        jobTitle: 'Angular Developer',
        salaryMin: 90_000,
        salaryMax: 80_000,
        salaryCurrency: 'EUR',
      });
    const salaryWithoutCurrency = await request(app)
      .post('/api/v1/applications')
      .set(authorize(user.accessToken))
      .send({ companyId: company.id, jobTitle: 'Angular Developer', salaryMin: 70_000 });
    const invalidAppliedAt = await request(app)
      .post('/api/v1/applications')
      .set(authorize(user.accessToken))
      .send({
        companyId: company.id,
        jobTitle: 'Angular Developer',
        appliedAt: '2026-07-05T00:00:00Z',
      });

    expect(missingCompany.status).toBe(400);
    expect(clientControlledFields.status).toBe(400);
    expect(invalidStatus.status).toBe(400);
    expect(invalidSalaryRange.status).toBe(400);
    expect(salaryWithoutCurrency.status).toBe(400);
    expect(invalidAppliedAt.status).toBe(400);
  });

  it('conceals cross-user companies and applications as not found', async () => {
    const owner = await createTestUser('owner@example.com');
    const otherUser = await createTestUser('other@example.com');
    const company = await createCompany(owner.id, 'Acme GmbH');
    const application = await createApplication(owner.id, company.id);

    const crossUserCreate = await request(app)
      .post('/api/v1/applications')
      .set(authorize(otherUser.accessToken))
      .send({ companyId: company.id, jobTitle: 'Angular Developer' });
    const crossUserGet = await request(app)
      .get(applicationUrl(application.id))
      .set(authorize(otherUser.accessToken));
    const crossUserUpdate = await request(app)
      .patch(applicationUrl(application.id))
      .set(authorize(otherUser.accessToken))
      .send({ jobTitle: 'Changed' });
    const crossUserDelete = await request(app)
      .delete(applicationUrl(application.id))
      .set(authorize(otherUser.accessToken));

    expect(crossUserCreate.status).toBe(404);
    expect(crossUserGet.status).toBe(404);
    expect(crossUserUpdate.status).toBe(404);
    expect(crossUserDelete.status).toBe(404);
  });

  it('requires supplied contacts to belong to the selected company', async () => {
    const user = await createTestUser('owner@example.com');
    const company = await createCompany(user.id, 'Acme GmbH');
    const otherCompany = await createCompany(user.id, 'Beta AG');
    const otherCompanyContact = await createContact(otherCompany.id, 'Grace');

    const response = await request(app)
      .post('/api/v1/applications')
      .set(authorize(user.accessToken))
      .send({
        companyId: company.id,
        contactId: otherCompanyContact.id,
        jobTitle: 'Angular Developer',
      });
    const body = response.body as ApiResponse<never>;

    expect(response.status).toBe(400);
    expect(body.error?.code).toBe('CONTACT_COMPANY_MISMATCH');
  });

  it('lists only owned applications with search, filters, pagination, and sorting', async () => {
    const user = await createTestUser('owner@example.com');
    const otherUser = await createTestUser('other@example.com');
    const acme = await createCompany(user.id, 'Acme GmbH');
    const beta = await createCompany(user.id, 'Beta AG');
    const otherCompany = await createCompany(otherUser.id, 'Acme Other');

    await createApplication(user.id, acme.id, {
      jobTitle: 'Senior Angular Developer',
      source: 'LinkedIn',
      status: 'applied',
      priority: 'high',
      location: 'Munich, Germany',
      employmentType: 'full_time',
      workMode: 'hybrid',
      appliedAt: '2026-07-05',
    });
    await createApplication(user.id, acme.id, {
      jobTitle: 'Angular Platform Engineer',
      source: 'Referral',
      status: 'applied',
      priority: 'medium',
      location: 'Munich, Germany',
      employmentType: 'full_time',
      workMode: 'hybrid',
      appliedAt: '2026-07-06',
    });
    await createApplication(user.id, beta.id, {
      jobTitle: 'Backend Engineer',
      source: 'LinkedIn',
      status: 'screening',
      priority: 'high',
      location: 'Berlin',
      employmentType: 'full_time',
      workMode: 'remote',
    });
    await createApplication(otherUser.id, otherCompany.id, {
      jobTitle: 'Senior Angular Developer',
      source: 'LinkedIn',
      status: 'applied',
      priority: 'high',
      location: 'Munich, Germany',
    });

    const response = await request(app)
      .get('/api/v1/applications')
      .query({
        search: 'angular',
        status: 'applied',
        companyId: acme.id,
        location: 'mun',
        employmentType: 'full_time',
        workMode: 'hybrid',
        sortBy: 'jobTitle',
        sortDirection: 'desc',
        page: 1,
        pageSize: 1,
      })
      .set(authorize(user.accessToken));
    const body = response.body as ApiResponse<ApplicationsResponse>;

    expect(response.status).toBe(200);
    expect(body.data?.applications).toHaveLength(1);
    expect(body.data?.applications[0]?.jobTitle).toBe('Senior Angular Developer');
    expect(body.meta).toEqual({
      page: 1,
      pageSize: 1,
      total: 2,
      totalPages: 2,
    });
  });

  it('finds applications by company name search and supports company-name sorting', async () => {
    const user = await createTestUser('owner@example.com');
    const acme = await createCompany(user.id, 'Acme GmbH');
    const beta = await createCompany(user.id, 'Beta AG');

    await createApplication(user.id, beta.id, { jobTitle: 'Backend Engineer' });
    await createApplication(user.id, acme.id, { jobTitle: 'Frontend Engineer' });

    const searchResponse = await request(app)
      .get('/api/v1/applications')
      .query({ search: 'acme' })
      .set(authorize(user.accessToken));
    const sortResponse = await request(app)
      .get('/api/v1/applications')
      .query({ sortBy: 'companyName', sortDirection: 'asc', pageSize: 10 })
      .set(authorize(user.accessToken));
    const searchBody = searchResponse.body as ApiResponse<ApplicationsResponse>;
    const sortBody = sortResponse.body as ApiResponse<ApplicationsResponse>;

    expect(searchResponse.status).toBe(200);
    expect(searchBody.data?.applications[0]?.company.name).toBe('Acme GmbH');
    expect(sortBody.data?.applications.map((application) => application.company.name)).toEqual([
      'Acme GmbH',
      'Beta AG',
    ]);
  });

  it('updates owned applications, clears optional fields, and protects contact/company consistency', async () => {
    const user = await createTestUser('owner@example.com');
    const company = await createCompany(user.id, 'Acme GmbH');
    const otherCompany = await createCompany(user.id, 'Beta AG');
    const contact = await createContact(company.id, 'Ada');
    const application = await createApplication(user.id, company.id, {
      contactId: contact.id,
      salaryMin: 70_000,
      salaryMax: 80_000,
      salaryCurrency: 'EUR',
    });

    const inconsistentCompanyChange = await request(app)
      .patch(applicationUrl(application.id))
      .set(authorize(user.accessToken))
      .send({ companyId: otherCompany.id });
    const invalidFinalSalary = await request(app)
      .patch(applicationUrl(application.id))
      .set(authorize(user.accessToken))
      .send({ salaryCurrency: null });
    const updateResponse = await request(app)
      .patch(applicationUrl(application.id))
      .set(authorize(user.accessToken))
      .send({
        contactId: null,
        jobTitle: ' Principal Angular Developer ',
        jobUrl: '',
        status: 'interviewing',
        salaryCurrency: 'eur',
        notes: '',
      });
    const updateBody = updateResponse.body as ApiResponse<ApplicationResponse>;

    expect(inconsistentCompanyChange.status).toBe(400);
    expect(invalidFinalSalary.status).toBe(400);
    expect(updateResponse.status).toBe(200);
    expect(updateBody.data?.application.contactId).toBeNull();
    expect(updateBody.data?.application.jobTitle).toBe('Principal Angular Developer');
    expect(updateBody.data?.application.jobUrl).toBeNull();
    expect(updateBody.data?.application.status).toBe('interviewing');
    expect(updateBody.data?.application.salaryCurrency).toBe('EUR');
    expect(updateBody.data?.application.notes).toBeNull();
  });

  it('soft-deletes owned applications', async () => {
    const user = await createTestUser('owner@example.com');
    const company = await createCompany(user.id, 'Acme GmbH');
    const application = await createApplication(user.id, company.id);

    const deleteResponse = await request(app)
      .delete(applicationUrl(application.id))
      .set(authorize(user.accessToken));
    const getResponse = await request(app)
      .get(applicationUrl(application.id))
      .set(authorize(user.accessToken));
    const deletedApplication = await JobApplicationModel.findByPk(application.id, {
      paranoid: false,
    });

    expect(deleteResponse.status).toBe(200);
    expect(getResponse.status).toBe(404);
    expect(deletedApplication?.deletedAt).toBeInstanceOf(Date);
  });
});
