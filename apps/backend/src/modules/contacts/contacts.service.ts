import crypto from 'node:crypto';

import { Op, WhereOptions } from 'sequelize';

import { CompanyModel } from '../../db/models/company.model.js';
import { ContactModel } from '../../db/models/contact.model.js';
import { HttpError } from '../../shared/errors/http-error.js';
import { CreateContactBody, ListContactsQuery, UpdateContactBody } from './contacts.schemas.js';
import { ContactDto, ContactListMeta } from './contacts.types.js';

type ContactListResult = {
  contacts: ContactDto[];
  meta: ContactListMeta;
};

type ContactChanges = {
  firstName?: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  roleTitle?: string | null;
  linkedInUrl?: string | null;
  notes?: string | null;
};

const sortColumnByField = {
  firstName: 'firstName',
  lastName: 'lastName',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
} as const;

function companyNotFoundError(): HttpError {
  return new HttpError(404, 'COMPANY_NOT_FOUND', 'Company was not found');
}

function contactNotFoundError(): HttpError {
  return new HttpError(404, 'CONTACT_NOT_FOUND', 'Contact was not found');
}

function toContactDto(contact: ContactModel): ContactDto {
  return {
    id: contact.id,
    companyId: contact.companyId,
    firstName: contact.firstName,
    lastName: contact.lastName ?? null,
    email: contact.email ?? null,
    phone: contact.phone ?? null,
    roleTitle: contact.roleTitle ?? null,
    linkedInUrl: contact.linkedInUrl ?? null,
    notes: contact.notes ?? null,
    createdAt: contact.createdAt.toISOString(),
    updatedAt: contact.updatedAt.toISOString(),
  };
}

function buildContactWhere(
  companyId: string,
  query: ListContactsQuery,
): WhereOptions<ContactModel> {
  const filters: WhereOptions<ContactModel>[] = [{ companyId }];

  if (query.search) {
    const search = `%${query.search}%`;
    filters.push({
      [Op.or]: [
        { firstName: { [Op.iLike]: search } },
        { lastName: { [Op.iLike]: search } },
        { email: { [Op.iLike]: search } },
        { roleTitle: { [Op.iLike]: search } },
      ],
    });
  }

  return {
    [Op.and]: filters,
  };
}

export class ContactsService {
  async listContacts(
    userId: string,
    companyId: string,
    query: ListContactsQuery,
  ): Promise<ContactListResult> {
    await this.findOwnedActiveCompany(userId, companyId);

    const offset = (query.page - 1) * query.pageSize;
    const orderDirection = query.sortDirection.toUpperCase();
    const sortColumn = sortColumnByField[query.sortBy];
    const { count, rows } = await ContactModel.findAndCountAll({
      where: buildContactWhere(companyId, query),
      order: [
        [sortColumn, orderDirection],
        ['id', 'ASC'],
      ],
      limit: query.pageSize,
      offset,
    });

    return {
      contacts: rows.map(toContactDto),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total: count,
        totalPages: Math.ceil(count / query.pageSize),
      },
    };
  }

  async createContact(
    userId: string,
    companyId: string,
    input: CreateContactBody,
  ): Promise<ContactDto> {
    await this.findOwnedActiveCompany(userId, companyId);

    const contact = await ContactModel.create({
      id: crypto.randomUUID(),
      companyId,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      roleTitle: input.roleTitle,
      linkedInUrl: input.linkedInUrl,
      notes: input.notes,
    });

    return toContactDto(contact);
  }

  async getContact(userId: string, companyId: string, contactId: string): Promise<ContactDto> {
    await this.findOwnedActiveCompany(userId, companyId);
    const contact = await this.findActiveContact(companyId, contactId);

    return toContactDto(contact);
  }

  async updateContact(
    userId: string,
    companyId: string,
    contactId: string,
    input: UpdateContactBody,
  ): Promise<ContactDto> {
    await this.findOwnedActiveCompany(userId, companyId);
    const contact = await this.findActiveContact(companyId, contactId);
    const changes: ContactChanges = {};

    if (input.firstName !== undefined) {
      changes.firstName = input.firstName;
    }

    if (input.lastName !== undefined) {
      changes.lastName = input.lastName;
    }

    if (input.email !== undefined) {
      changes.email = input.email;
    }

    if (input.phone !== undefined) {
      changes.phone = input.phone;
    }

    if (input.roleTitle !== undefined) {
      changes.roleTitle = input.roleTitle;
    }

    if (input.linkedInUrl !== undefined) {
      changes.linkedInUrl = input.linkedInUrl;
    }

    if (input.notes !== undefined) {
      changes.notes = input.notes;
    }

    contact.set(changes);
    await contact.save();

    return toContactDto(contact);
  }

  async deleteContact(userId: string, companyId: string, contactId: string): Promise<void> {
    await this.findOwnedActiveCompany(userId, companyId);
    const contact = await this.findActiveContact(companyId, contactId);

    await contact.destroy();
  }

  private async findOwnedActiveCompany(userId: string, companyId: string): Promise<CompanyModel> {
    const company = await CompanyModel.findOne({
      where: {
        id: companyId,
        userId,
      },
    });

    if (!company) {
      throw companyNotFoundError();
    }

    return company;
  }

  private async findActiveContact(companyId: string, contactId: string): Promise<ContactModel> {
    const contact = await ContactModel.findOne({
      where: {
        id: contactId,
        companyId,
      },
    });

    if (!contact) {
      throw contactNotFoundError();
    }

    return contact;
  }
}
