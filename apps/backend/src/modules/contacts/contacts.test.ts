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
import { ContactDto } from './contacts.types.js';

type ContactResponse = {
  contact: ContactDto;
};

type ContactsResponse = {
  contacts: ContactDto[];
};

function assertTestDatabase(): void {
  const databaseUrl = process.env.DATABASE_URL;
  const databaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';

  if (process.env.NODE_ENV !== 'test' || !databaseName.toLowerCase().includes('test')) {
    throw new Error('Contact integration tests must run against a test database');
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

async function createContact(
  companyId: string,
  firstName: string,
  overrides: Partial<ContactModel> = {},
) {
  return ContactModel.create({
    id: crypto.randomUUID(),
    companyId,
    firstName,
    lastName: null,
    email: null,
    phone: null,
    roleTitle: null,
    linkedInUrl: null,
    notes: null,
    ...overrides,
  });
}

function authorize(accessToken: string): { Authorization: string } {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

function contactsUrl(companyId: string): string {
  return `/api/v1/companies/${companyId}/contacts`;
}

function contactUrl(companyId: string, contactId: string): string {
  return `${contactsUrl(companyId)}/${contactId}`;
}

describe('contacts API', () => {
  const app = createApp({ disableRateLimits: true });

  beforeAll(async () => {
    assertTestDatabase();
    await createMigrator().up();
  });

  beforeEach(async () => {
    await truncateBusinessTables();
  });

  it('requires authentication for every contact endpoint', async () => {
    const companyId = crypto.randomUUID();
    const contactId = crypto.randomUUID();

    const responses = await Promise.all([
      request(app).get(contactsUrl(companyId)),
      request(app).post(contactsUrl(companyId)).send({ firstName: 'Ada' }),
      request(app).get(contactUrl(companyId, contactId)),
      request(app).patch(contactUrl(companyId, contactId)).send({ firstName: 'Grace' }),
      request(app).delete(contactUrl(companyId, contactId)),
    ]);

    for (const response of responses) {
      const body = response.body as ApiResponse<never>;

      expect(response.status).toBe(401);
      expect(body.error?.code).toBe('AUTH_TOKEN_MISSING');
    }
  });

  it('creates a contact under an owned company and normalizes fields', async () => {
    const user = await createTestUser('owner@example.com');
    const company = await createCompany(user.id, 'Acme GmbH');

    const response = await request(app)
      .post(contactsUrl(company.id))
      .set(authorize(user.accessToken))
      .send({
        firstName: '  Ada  ',
        lastName: ' Lovelace ',
        email: ' ADA@EXAMPLE.COM ',
        phone: ' +49 30 123 ',
        roleTitle: ' Recruiter ',
        linkedInUrl: ' https://www.linkedin.com/in/ada-lovelace ',
        notes: ' Follow up in two weeks ',
      });
    const body = response.body as ApiResponse<ContactResponse>;

    expect(response.status).toBe(201);
    expect(body.data?.contact.companyId).toBe(company.id);
    expect(body.data?.contact.firstName).toBe('Ada');
    expect(body.data?.contact.lastName).toBe('Lovelace');
    expect(body.data?.contact.email).toBe('ada@example.com');
    expect(body.data?.contact.linkedInUrl).toBe('https://www.linkedin.com/in/ada-lovelace');
  });

  it('rejects invalid create payloads and client-controlled fields', async () => {
    const user = await createTestUser('owner@example.com');
    const company = await createCompany(user.id, 'Acme GmbH');
    const route = contactsUrl(company.id);

    const missingFirstName = await request(app)
      .post(route)
      .set(authorize(user.accessToken))
      .send({});
    const whitespaceFirstName = await request(app)
      .post(route)
      .set(authorize(user.accessToken))
      .send({ firstName: '   ' });
    const invalidEmail = await request(app)
      .post(route)
      .set(authorize(user.accessToken))
      .send({ firstName: 'Ada', email: 'not-an-email' });
    const invalidLinkedInUrl = await request(app)
      .post(route)
      .set(authorize(user.accessToken))
      .send({ firstName: 'Ada', linkedInUrl: 'not-a-url' });
    const clientControlledFields = await request(app)
      .post(route)
      .set(authorize(user.accessToken))
      .send({
        id: crypto.randomUUID(),
        companyId: crypto.randomUUID(),
        userId: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        deletedAt: null,
        firstName: 'Ada',
      });

    expect(missingFirstName.status).toBe(400);
    expect(whitespaceFirstName.status).toBe(400);
    expect(invalidEmail.status).toBe(400);
    expect(invalidLinkedInUrl.status).toBe(400);
    expect(clientControlledFields.status).toBe(400);
  });

  it('conceals unknown and cross-user parent companies for list and create', async () => {
    const owner = await createTestUser('owner@example.com');
    const otherUser = await createTestUser('other@example.com');
    const company = await createCompany(owner.id, 'Acme GmbH');

    const unknownCompanyResponse = await request(app)
      .get(contactsUrl(crypto.randomUUID()))
      .set(authorize(owner.accessToken));
    const crossUserListResponse = await request(app)
      .get(contactsUrl(company.id))
      .set(authorize(otherUser.accessToken));
    const crossUserCreateResponse = await request(app)
      .post(contactsUrl(company.id))
      .set(authorize(otherUser.accessToken))
      .send({ firstName: 'Ada' });

    expect(unknownCompanyResponse.status).toBe(404);
    expect(crossUserListResponse.status).toBe(404);
    expect(crossUserCreateResponse.status).toBe(404);
  });

  it('lists only active contacts for the requested company with pagination, search, and deterministic sorting', async () => {
    const user = await createTestUser('owner@example.com');
    const company = await createCompany(user.id, 'Acme GmbH');
    const otherCompany = await createCompany(user.id, 'Beta AG');

    await createContact(company.id, 'Ada', {
      lastName: 'Lovelace',
      email: 'ada@example.com',
      roleTitle: 'Recruiter',
    });
    await createContact(company.id, 'Grace', {
      lastName: 'Hopper',
      email: 'grace@example.com',
      roleTitle: 'Engineering Manager',
    });
    const deletedContact = await createContact(company.id, 'Alan', {
      lastName: 'Turing',
      email: 'alan@example.com',
      roleTitle: 'Recruiter',
    });
    await createContact(otherCompany.id, 'Katherine', {
      lastName: 'Johnson',
      email: 'katherine@example.com',
      roleTitle: 'Recruiter',
    });
    await deletedContact.destroy();

    const response = await request(app)
      .get(contactsUrl(company.id))
      .query({
        search: 'recruiter',
        sortBy: 'firstName',
        sortDirection: 'desc',
        page: 1,
        pageSize: 1,
      })
      .set(authorize(user.accessToken));
    const body = response.body as ApiResponse<ContactsResponse>;

    expect(response.status).toBe(200);
    expect(body.data?.contacts).toHaveLength(1);
    expect(body.data?.contacts[0]?.firstName).toBe('Ada');
    expect(body.meta).toEqual({
      page: 1,
      pageSize: 1,
      total: 1,
      totalPages: 1,
    });
  });

  it('rejects invalid contact list query values', async () => {
    const user = await createTestUser('owner@example.com');
    const company = await createCompany(user.id, 'Acme GmbH');

    const response = await request(app)
      .get(contactsUrl(company.id))
      .query({
        page: 0,
        pageSize: 101,
        sortBy: 'email',
      })
      .set(authorize(user.accessToken));
    const body = response.body as ApiResponse<never>;

    expect(response.status).toBe(400);
    expect(body.error?.code).toBe('VALIDATION_ERROR');
  });

  it('retrieves contacts only through the owned parent company and correct contact company', async () => {
    const owner = await createTestUser('owner@example.com');
    const otherUser = await createTestUser('other@example.com');
    const company = await createCompany(owner.id, 'Acme GmbH');
    const otherCompany = await createCompany(owner.id, 'Beta AG');
    const contact = await createContact(company.id, 'Ada');
    const otherCompanyContact = await createContact(otherCompany.id, 'Grace');
    const deletedContact = await createContact(company.id, 'Alan');

    await deletedContact.destroy();

    const ownedResponse = await request(app)
      .get(contactUrl(company.id, contact.id))
      .set(authorize(owner.accessToken));
    const unknownResponse = await request(app)
      .get(contactUrl(company.id, crypto.randomUUID()))
      .set(authorize(owner.accessToken));
    const crossCompanyResponse = await request(app)
      .get(contactUrl(company.id, otherCompanyContact.id))
      .set(authorize(owner.accessToken));
    const crossUserResponse = await request(app)
      .get(contactUrl(company.id, contact.id))
      .set(authorize(otherUser.accessToken));
    const deletedResponse = await request(app)
      .get(contactUrl(company.id, deletedContact.id))
      .set(authorize(owner.accessToken));

    expect(ownedResponse.status).toBe(200);
    expect(unknownResponse.status).toBe(404);
    expect(crossCompanyResponse.status).toBe(404);
    expect(crossUserResponse.status).toBe(404);
    expect(deletedResponse.status).toBe(404);
  });

  it('updates contacts partially, clears optional fields, and prevents moving contacts', async () => {
    const owner = await createTestUser('owner@example.com');
    const otherUser = await createTestUser('other@example.com');
    const company = await createCompany(owner.id, 'Acme GmbH');
    const otherCompany = await createCompany(owner.id, 'Beta AG');
    const contact = await createContact(company.id, 'Ada', {
      lastName: 'Lovelace',
      email: 'ada@example.com',
      phone: '+49 30 123',
    });
    const otherCompanyContact = await createContact(otherCompany.id, 'Grace');

    const emptyUpdateResponse = await request(app)
      .patch(contactUrl(company.id, contact.id))
      .set(authorize(owner.accessToken))
      .send({});
    const moveResponse = await request(app)
      .patch(contactUrl(company.id, contact.id))
      .set(authorize(owner.accessToken))
      .send({
        companyId: otherCompany.id,
      });
    const crossCompanyResponse = await request(app)
      .patch(contactUrl(company.id, otherCompanyContact.id))
      .set(authorize(owner.accessToken))
      .send({
        firstName: 'Grace',
      });
    const crossUserResponse = await request(app)
      .patch(contactUrl(company.id, contact.id))
      .set(authorize(otherUser.accessToken))
      .send({
        firstName: 'Changed',
      });
    const updateResponse = await request(app)
      .patch(contactUrl(company.id, contact.id))
      .set(authorize(owner.accessToken))
      .send({
        firstName: ' Ada Byron ',
        lastName: '',
        email: '',
      });
    const updateBody = updateResponse.body as ApiResponse<ContactResponse>;

    expect(emptyUpdateResponse.status).toBe(400);
    expect(moveResponse.status).toBe(400);
    expect(crossCompanyResponse.status).toBe(404);
    expect(crossUserResponse.status).toBe(404);
    expect(updateResponse.status).toBe(200);
    expect(updateBody.data?.contact.firstName).toBe('Ada Byron');
    expect(updateBody.data?.contact.lastName).toBeNull();
    expect(updateBody.data?.contact.email).toBeNull();
    expect(updateBody.data?.contact.phone).toBe('+49 30 123');
  });

  it('soft-deletes owned contacts without affecting other contacts', async () => {
    const owner = await createTestUser('owner@example.com');
    const otherUser = await createTestUser('other@example.com');
    const company = await createCompany(owner.id, 'Acme GmbH');
    const otherCompany = await createCompany(owner.id, 'Beta AG');
    const contact = await createContact(company.id, 'Ada');
    const remainingContact = await createContact(company.id, 'Grace');
    const otherCompanyContact = await createContact(otherCompany.id, 'Alan');

    const crossCompanyResponse = await request(app)
      .delete(contactUrl(company.id, otherCompanyContact.id))
      .set(authorize(owner.accessToken));
    const crossUserResponse = await request(app)
      .delete(contactUrl(company.id, contact.id))
      .set(authorize(otherUser.accessToken));
    const deleteResponse = await request(app)
      .delete(contactUrl(company.id, contact.id))
      .set(authorize(owner.accessToken));
    const deletedResponse = await request(app)
      .get(contactUrl(company.id, contact.id))
      .set(authorize(owner.accessToken));
    const deletedContact = await ContactModel.findByPk(contact.id, { paranoid: false });
    const activeContact = await ContactModel.findByPk(remainingContact.id);
    const activeOtherCompanyContact = await ContactModel.findByPk(otherCompanyContact.id);

    expect(crossCompanyResponse.status).toBe(404);
    expect(crossUserResponse.status).toBe(404);
    expect(deleteResponse.status).toBe(200);
    expect(deletedResponse.status).toBe(404);
    expect(deletedContact?.deletedAt).toBeInstanceOf(Date);
    expect(activeContact).not.toBeNull();
    expect(activeOtherCompanyContact).not.toBeNull();
  });
});
