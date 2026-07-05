import crypto from 'node:crypto';

import { Op, Order, WhereOptions } from 'sequelize';

import { CompanyModel } from '../../db/models/company.model.js';
import { ContactModel } from '../../db/models/contact.model.js';
import { JobApplicationModel } from '../../db/models/job-application.model.js';
import { HttpError } from '../../shared/errors/http-error.js';
import {
  CreateApplicationBody,
  ListApplicationsQuery,
  UpdateApplicationBody,
} from './applications.schemas.js';
import { ApplicationListMeta, JobApplicationDto } from './applications.types.js';

type ApplicationListResult = {
  applications: JobApplicationDto[];
  meta: ApplicationListMeta;
};

type ApplicationChanges = {
  companyId?: string;
  contactId?: string | null;
  jobTitle?: string;
  jobUrl?: string | null;
  source?: string | null;
  status?: JobApplicationModel['status'];
  priority?: JobApplicationModel['priority'];
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  location?: string | null;
  employmentType?: string | null;
  workMode?: string | null;
  appliedAt?: string | null;
  notes?: string | null;
};

const sortColumnByField = {
  jobTitle: 'jobTitle',
  status: 'status',
  priority: 'priority',
  appliedAt: 'appliedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
} as const;

function applicationNotFoundError(): HttpError {
  return new HttpError(404, 'APPLICATION_NOT_FOUND', 'Application was not found');
}

function companyNotFoundError(): HttpError {
  return new HttpError(404, 'COMPANY_NOT_FOUND', 'Company was not found');
}

function contactNotFoundError(): HttpError {
  return new HttpError(404, 'CONTACT_NOT_FOUND', 'Contact was not found');
}

function contactCompanyMismatchError(): HttpError {
  return new HttpError(
    400,
    'CONTACT_COMPANY_MISMATCH',
    'Contact must belong to the selected company',
  );
}

function invalidSalaryError(): HttpError {
  return new HttpError(
    400,
    'INVALID_SALARY_RANGE',
    'Salary currency is required when salary is provided, and min must be <= max',
  );
}

function toApplicationDto(application: JobApplicationModel): JobApplicationDto {
  const company = application.get('company') as CompanyModel;
  const contact = application.get('contact') as ContactModel | null;

  return {
    id: application.id,
    userId: application.userId,
    companyId: application.companyId,
    contactId: application.contactId ?? null,
    jobTitle: application.jobTitle,
    jobUrl: application.jobUrl ?? null,
    source: application.source ?? null,
    status: application.status,
    priority: application.priority,
    salaryMin: application.salaryMin ?? null,
    salaryMax: application.salaryMax ?? null,
    salaryCurrency: application.salaryCurrency ?? null,
    location: application.location ?? null,
    employmentType: application.employmentType ?? null,
    workMode: application.workMode ?? null,
    appliedAt: application.appliedAt ?? null,
    notes: application.notes ?? null,
    company: {
      id: company.id,
      name: company.name,
    },
    contact: contact
      ? {
          id: contact.id,
          firstName: contact.firstName,
          lastName: contact.lastName ?? null,
          email: contact.email ?? null,
        }
      : null,
    createdAt: application.createdAt.toISOString(),
    updatedAt: application.updatedAt.toISOString(),
  };
}

function buildApplicationWhere(
  userId: string,
  query: ListApplicationsQuery,
): WhereOptions<JobApplicationModel> {
  const filters: WhereOptions<JobApplicationModel>[] = [{ userId }];

  if (query.search) {
    const search = `%${query.search}%`;
    filters.push({
      [Op.or]: [
        { jobTitle: { [Op.iLike]: search } },
        { source: { [Op.iLike]: search } },
        { location: { [Op.iLike]: search } },
        { '$company.name$': { [Op.iLike]: search } },
      ],
    });
  }

  if (query.status) {
    filters.push({ status: query.status });
  }

  if (query.priority) {
    filters.push({ priority: query.priority });
  }

  if (query.companyId) {
    filters.push({ companyId: query.companyId });
  }

  if (query.contactId) {
    filters.push({ contactId: query.contactId });
  }

  if (query.source) {
    filters.push({ source: { [Op.iLike]: `%${query.source}%` } });
  }

  if (query.location) {
    filters.push({ location: { [Op.iLike]: `%${query.location}%` } });
  }

  if (query.employmentType) {
    filters.push({ employmentType: query.employmentType });
  }

  if (query.workMode) {
    filters.push({ workMode: query.workMode });
  }

  return {
    [Op.and]: filters,
  };
}

export class ApplicationsService {
  async listApplications(
    userId: string,
    query: ListApplicationsQuery,
  ): Promise<ApplicationListResult> {
    const offset = (query.page - 1) * query.pageSize;
    const orderDirection = query.sortDirection.toUpperCase();
    const order: Order =
      query.sortBy === 'companyName'
        ? [
            [{ model: CompanyModel, as: 'company' }, 'name', orderDirection],
            ['id', 'ASC'],
          ]
        : [
            [sortColumnByField[query.sortBy], orderDirection],
            ['id', 'ASC'],
          ];

    const { count, rows } = await JobApplicationModel.findAndCountAll({
      where: buildApplicationWhere(userId, query),
      include: [
        {
          model: CompanyModel,
          as: 'company',
          required: true,
          where: { userId },
        },
        {
          model: ContactModel,
          as: 'contact',
          required: false,
        },
      ],
      order,
      limit: query.pageSize,
      offset,
    });

    return {
      applications: rows.map(toApplicationDto),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total: count,
        totalPages: Math.ceil(count / query.pageSize),
      },
    };
  }

  async createApplication(
    userId: string,
    input: CreateApplicationBody,
  ): Promise<JobApplicationDto> {
    await this.findOwnedActiveCompany(userId, input.companyId);
    await this.verifyContactBelongsToCompany(userId, input.companyId, input.contactId ?? null);
    this.assertValidSalaryState(
      input.salaryMin ?? null,
      input.salaryMax ?? null,
      input.salaryCurrency ?? null,
    );

    const application = await JobApplicationModel.create({
      id: crypto.randomUUID(),
      userId,
      companyId: input.companyId,
      contactId: input.contactId ?? null,
      jobTitle: input.jobTitle,
      jobUrl: input.jobUrl,
      source: input.source,
      status: input.status,
      priority: input.priority,
      salaryMin: input.salaryMin,
      salaryMax: input.salaryMax,
      salaryCurrency: input.salaryCurrency,
      location: input.location,
      employmentType: input.employmentType,
      workMode: input.workMode,
      appliedAt: input.appliedAt,
      notes: input.notes,
    });

    return this.getApplication(userId, application.id);
  }

  async getApplication(userId: string, applicationId: string): Promise<JobApplicationDto> {
    const application = await this.findOwnedActiveApplication(userId, applicationId);

    return toApplicationDto(application);
  }

  async updateApplication(
    userId: string,
    applicationId: string,
    input: UpdateApplicationBody,
  ): Promise<JobApplicationDto> {
    const application = await this.findOwnedActiveApplication(userId, applicationId);
    const nextCompanyId = input.companyId ?? application.companyId;
    const nextContactId = input.contactId !== undefined ? input.contactId : application.contactId;
    const nextSalaryMin = input.salaryMin !== undefined ? input.salaryMin : application.salaryMin;
    const nextSalaryMax = input.salaryMax !== undefined ? input.salaryMax : application.salaryMax;
    const nextSalaryCurrency =
      input.salaryCurrency !== undefined ? input.salaryCurrency : application.salaryCurrency;
    const changes: ApplicationChanges = {};

    if (input.companyId !== undefined) {
      await this.findOwnedActiveCompany(userId, input.companyId);
      changes.companyId = input.companyId;
    }

    await this.verifyContactBelongsToCompany(userId, nextCompanyId, nextContactId ?? null);
    this.assertValidSalaryState(
      nextSalaryMin ?? null,
      nextSalaryMax ?? null,
      nextSalaryCurrency ?? null,
    );

    if (input.contactId !== undefined) {
      changes.contactId = input.contactId;
    }

    if (input.jobTitle !== undefined) {
      changes.jobTitle = input.jobTitle;
    }

    if (input.jobUrl !== undefined) {
      changes.jobUrl = input.jobUrl;
    }

    if (input.source !== undefined) {
      changes.source = input.source;
    }

    if (input.status !== undefined) {
      changes.status = input.status;
    }

    if (input.priority !== undefined) {
      changes.priority = input.priority;
    }

    if (input.salaryMin !== undefined) {
      changes.salaryMin = input.salaryMin;
    }

    if (input.salaryMax !== undefined) {
      changes.salaryMax = input.salaryMax;
    }

    if (input.salaryCurrency !== undefined) {
      changes.salaryCurrency = input.salaryCurrency;
    }

    if (input.location !== undefined) {
      changes.location = input.location;
    }

    if (input.employmentType !== undefined) {
      changes.employmentType = input.employmentType;
    }

    if (input.workMode !== undefined) {
      changes.workMode = input.workMode;
    }

    if (input.appliedAt !== undefined) {
      changes.appliedAt = input.appliedAt;
    }

    if (input.notes !== undefined) {
      changes.notes = input.notes;
    }

    application.set(changes);
    await application.save();

    return this.getApplication(userId, application.id);
  }

  async deleteApplication(userId: string, applicationId: string): Promise<void> {
    const application = await JobApplicationModel.findOne({
      where: {
        id: applicationId,
        userId,
      },
      include: [
        {
          model: CompanyModel,
          as: 'company',
          required: true,
          where: { userId },
        },
      ],
    });

    if (!application) {
      throw applicationNotFoundError();
    }

    await application.destroy();
  }

  private async findOwnedActiveApplication(
    userId: string,
    applicationId: string,
  ): Promise<JobApplicationModel> {
    const application = await JobApplicationModel.findOne({
      where: {
        id: applicationId,
        userId,
      },
      include: [
        {
          model: CompanyModel,
          as: 'company',
          required: true,
          where: { userId },
        },
        {
          model: ContactModel,
          as: 'contact',
          required: false,
        },
      ],
    });

    if (!application) {
      throw applicationNotFoundError();
    }

    return application;
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

  private async verifyContactBelongsToCompany(
    userId: string,
    companyId: string,
    contactId: string | null,
  ): Promise<void> {
    if (!contactId) {
      return;
    }

    const contact = await ContactModel.findOne({
      where: { id: contactId },
      include: [
        {
          model: CompanyModel,
          as: 'company',
          required: true,
          where: { userId },
        },
      ],
    });

    if (!contact) {
      throw contactNotFoundError();
    }

    if (contact.companyId !== companyId) {
      throw contactCompanyMismatchError();
    }
  }

  private assertValidSalaryState(
    salaryMin: number | null,
    salaryMax: number | null,
    salaryCurrency: string | null,
  ): void {
    if (salaryMin !== null && salaryMax !== null && salaryMin > salaryMax) {
      throw invalidSalaryError();
    }

    if ((salaryMin !== null || salaryMax !== null) && salaryCurrency === null) {
      throw invalidSalaryError();
    }
  }
}
