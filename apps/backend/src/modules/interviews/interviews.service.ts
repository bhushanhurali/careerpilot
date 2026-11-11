import crypto from 'node:crypto';

import { CompanyModel } from '../../db/models/company.model.js';
import { InterviewModel } from '../../db/models/interview.model.js';
import { JobApplicationModel } from '../../db/models/job-application.model.js';
import { HttpError } from '../../shared/errors/http-error.js';
import { CreateInterviewBody, UpdateInterviewBody } from './interviews.schemas.js';
import { InterviewDto } from './interviews.types.js';

function toInterviewDto(interview: InterviewModel): InterviewDto {
  return {
    id: interview.id,
    applicationId: interview.applicationId,
    type: interview.type,
    status: interview.status,
    scheduledAt: interview.scheduledAt.toISOString(),
    durationMinutes: interview.durationMinutes ?? null,
    location: interview.location ?? null,
    meetingUrl: interview.meetingUrl ?? null,
    notes: interview.notes ?? null,
    createdAt: interview.createdAt.toISOString(),
    updatedAt: interview.updatedAt.toISOString(),
  };
}

export class InterviewsService {
  async listInterviews(userId: string, applicationId: string): Promise<InterviewDto[]> {
    await this.findOwnedActiveApplication(userId, applicationId);

    const interviews = await InterviewModel.findAll({
      where: { applicationId },
      order: [
        ['scheduledAt', 'ASC'],
        ['id', 'ASC'],
      ],
    });

    return interviews.map(toInterviewDto);
  }

  async createInterview(
    userId: string,
    applicationId: string,
    input: CreateInterviewBody,
  ): Promise<InterviewDto> {
    await this.findOwnedActiveApplication(userId, applicationId);

    const interview = await InterviewModel.create({
      ...input,
      id: crypto.randomUUID(),
      applicationId,
      scheduledAt: new Date(input.scheduledAt),
    });

    return toInterviewDto(interview);
  }

  async updateInterview(
    userId: string,
    applicationId: string,
    interviewId: string,
    input: UpdateInterviewBody,
  ): Promise<InterviewDto> {
    await this.findOwnedActiveApplication(userId, applicationId);
    const interview = await this.findActiveInterview(applicationId, interviewId);
    if (input.type !== undefined) {
      interview.type = input.type;
    }
    if (input.status !== undefined) {
      interview.status = input.status;
    }
    if (input.scheduledAt !== undefined) {
      interview.scheduledAt = new Date(input.scheduledAt);
    }
    if (input.durationMinutes !== undefined) {
      interview.durationMinutes = input.durationMinutes;
    }
    if (input.location !== undefined) {
      interview.location = input.location;
    }
    if (input.meetingUrl !== undefined) {
      interview.meetingUrl = input.meetingUrl;
    }
    if (input.notes !== undefined) {
      interview.notes = input.notes;
    }
    await interview.save();

    return toInterviewDto(interview);
  }

  async deleteInterview(userId: string, applicationId: string, interviewId: string): Promise<void> {
    await this.findOwnedActiveApplication(userId, applicationId);
    const interview = await this.findActiveInterview(applicationId, interviewId);

    await interview.destroy();
  }

  private async findOwnedActiveApplication(userId: string, applicationId: string): Promise<void> {
    const application = await JobApplicationModel.findOne({
      where: { id: applicationId, userId },
      include: [{ model: CompanyModel, as: 'company', required: true, where: { userId } }],
    });

    if (!application) {
      throw new HttpError(404, 'APPLICATION_NOT_FOUND', 'Application was not found');
    }
  }

  private async findActiveInterview(
    applicationId: string,
    interviewId: string,
  ): Promise<InterviewModel> {
    const interview = await InterviewModel.findOne({
      where: { id: interviewId, applicationId },
    });

    if (!interview) {
      throw new HttpError(404, 'INTERVIEW_NOT_FOUND', 'Interview was not found');
    }

    return interview;
  }
}
