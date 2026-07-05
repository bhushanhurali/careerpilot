import crypto from 'node:crypto';

import { Op, UniqueConstraintError, WhereOptions } from 'sequelize';

import { CompanyModel } from '../../db/models/company.model.js';
import { ContactModel } from '../../db/models/contact.model.js';
import { sequelize } from '../../db/sequelize.js';
import { HttpError } from '../../shared/errors/http-error.js';
import { CreateCompanyBody, ListCompaniesQuery, UpdateCompanyBody } from './companies.schemas.js';
import { CompanyDto, CompanyListMeta } from './companies.types.js';

type CompanyListResult = {
  companies: CompanyDto[];
  meta: CompanyListMeta;
};

type CompanyChanges = {
  name?: string;
  website?: string | null;
  industry?: string | null;
  location?: string | null;
  notes?: string | null;
};

const sortColumnByField = {
  name: 'name',
  industry: 'industry',
  location: 'location',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
} as const;

function companyNotFoundError(): HttpError {
  return new HttpError(404, 'COMPANY_NOT_FOUND', 'Company was not found');
}

function duplicateCompanyNameError(): HttpError {
  return new HttpError(
    409,
    'COMPANY_NAME_ALREADY_EXISTS',
    'A company with this name already exists',
  );
}

function toCompanyDto(company: CompanyModel): CompanyDto {
  return {
    id: company.id,
    name: company.name,
    website: company.website ?? null,
    industry: company.industry ?? null,
    location: company.location ?? null,
    notes: company.notes ?? null,
    createdAt: company.createdAt.toISOString(),
    updatedAt: company.updatedAt.toISOString(),
  };
}

function isUniqueCompanyNameError(error: unknown): boolean {
  return error instanceof UniqueConstraintError;
}

function buildCompanyWhere(userId: string, query: ListCompaniesQuery): WhereOptions<CompanyModel> {
  const filters: WhereOptions<CompanyModel>[] = [{ userId }];

  if (query.search) {
    filters.push({
      name: {
        [Op.iLike]: `%${query.search}%`,
      },
    });
  }

  if (query.industry) {
    filters.push({
      industry: {
        [Op.iLike]: `%${query.industry}%`,
      },
    });
  }

  if (query.location) {
    filters.push({
      location: {
        [Op.iLike]: `%${query.location}%`,
      },
    });
  }

  return {
    [Op.and]: filters,
  };
}

export class CompaniesService {
  async listCompanies(userId: string, query: ListCompaniesQuery): Promise<CompanyListResult> {
    const offset = (query.page - 1) * query.pageSize;
    const orderDirection = query.sortDirection.toUpperCase();
    const sortColumn = sortColumnByField[query.sortBy];
    const { count, rows } = await CompanyModel.findAndCountAll({
      where: buildCompanyWhere(userId, query),
      order: [
        [sortColumn, orderDirection],
        ['id', 'ASC'],
      ],
      limit: query.pageSize,
      offset,
    });

    return {
      companies: rows.map(toCompanyDto),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total: count,
        totalPages: Math.ceil(count / query.pageSize),
      },
    };
  }

  async createCompany(userId: string, input: CreateCompanyBody): Promise<CompanyDto> {
    try {
      const company = await CompanyModel.create({
        id: crypto.randomUUID(),
        userId,
        name: input.name,
        website: input.website,
        industry: input.industry,
        location: input.location,
        notes: input.notes,
      });

      return toCompanyDto(company);
    } catch (error) {
      if (isUniqueCompanyNameError(error)) {
        throw duplicateCompanyNameError();
      }

      throw error;
    }
  }

  async getCompany(userId: string, companyId: string): Promise<CompanyDto> {
    const company = await this.findOwnedActiveCompany(userId, companyId);

    return toCompanyDto(company);
  }

  async updateCompany(
    userId: string,
    companyId: string,
    input: UpdateCompanyBody,
  ): Promise<CompanyDto> {
    const company = await this.findOwnedActiveCompany(userId, companyId);
    const changes: CompanyChanges = {};

    if (input.name !== undefined) {
      changes.name = input.name;
    }

    if (input.website !== undefined) {
      changes.website = input.website;
    }

    if (input.industry !== undefined) {
      changes.industry = input.industry;
    }

    if (input.location !== undefined) {
      changes.location = input.location;
    }

    if (input.notes !== undefined) {
      changes.notes = input.notes;
    }

    try {
      company.set(changes);
      await company.save();

      return toCompanyDto(company);
    } catch (error) {
      if (isUniqueCompanyNameError(error)) {
        throw duplicateCompanyNameError();
      }

      throw error;
    }
  }

  async deleteCompany(userId: string, companyId: string): Promise<void> {
    await sequelize.transaction(async (transaction) => {
      const company = await CompanyModel.findOne({
        where: {
          id: companyId,
          userId,
        },
        transaction,
      });

      if (!company) {
        throw companyNotFoundError();
      }

      await ContactModel.destroy({
        where: {
          companyId: company.id,
        },
        transaction,
      });
      await company.destroy({ transaction });
    });
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
}
