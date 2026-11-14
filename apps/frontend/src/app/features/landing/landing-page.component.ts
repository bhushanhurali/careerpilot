import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { productBrand } from '../../core/config/product-brand';
import { ThemeSwitcherComponent } from '../../core/theme/theme-switcher.component';

@Component({
  selector: 'cp-landing-page',
  imports: [RouterLink, MatButtonModule, MatIconModule, ThemeSwitcherComponent],
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingPageComponent {
  protected readonly brand = productBrand;
  protected readonly features = [
    {
      icon: 'work_outline',
      title: 'Applications & status history',
      detail: 'Track roles from first draft to final decision, with a timeline of status changes.',
    },
    {
      icon: 'business',
      title: 'Companies & contacts',
      detail:
        'Keep employers, recruiters, and hiring contacts together with the roles they belong to.',
    },
    {
      icon: 'event',
      title: 'Interviews',
      detail: 'Schedule rounds and keep meeting links, locations, and notes with each application.',
    },
    {
      icon: 'checklist',
      title: 'Tasks & notifications',
      detail: 'Plan follow-ups and see in-app reminders for interviews and due or overdue tasks.',
    },
    {
      icon: 'description',
      title: 'Resumes & job matching',
      detail:
        'Manage private PDF and DOCX resumes. Compare recognized skills with a job description using transparent, deterministic coverage.',
    },
    {
      icon: 'space_dashboard',
      title: 'Dashboard analytics',
      detail: 'See application trends, status breakdowns, and upcoming work in one place.',
    },
  ];
  protected readonly steps = [
    {
      title: 'Add a role',
      detail:
        'Link an application to a company and add the job description and contacts you want to keep.',
    },
    {
      title: 'Prepare and follow up',
      detail: 'Compare resume skills, schedule interviews, and turn next steps into tasks.',
    },
    {
      title: 'Review your progress',
      detail: 'Update application statuses and use the dashboard to see what needs attention.',
    },
  ];
  protected readonly sampleMetrics = [
    { label: 'Active applications', value: 8, icon: 'work_outline' },
    { label: 'Upcoming interviews', value: 2, icon: 'event' },
    { label: 'Overdue tasks', value: 1, icon: 'checklist' },
  ];
  protected readonly sampleStatuses = [
    { label: 'Applied', count: 4 },
    { label: 'Screening', count: 2 },
    { label: 'Interviewing', count: 2 },
  ];
}
