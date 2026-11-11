/// <reference types="jasmine" />

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Subject } from 'rxjs';

import { API_BASE_URL } from '../../../../core/config/api.config';
import { Interview } from '../../data-access/interview.models';
import { InterviewDeleteDialogData } from '../interview-delete-dialog/interview-delete-dialog.component';
import { InterviewFormDialogData } from '../interview-form-dialog/interview-form-dialog.component';
import { InterviewListComponent } from './interview-list.component';

describe('InterviewListComponent', () => {
  const url = `${API_BASE_URL}/applications/application-1/interviews`;
  const formValue = {
    type: 'technical',
    status: 'scheduled',
    scheduledAt: '2026-12-03T11:00:00.000Z',
    durationMinutes: 45,
    location: 'Berlin',
    meetingUrl: 'https://meet.example/interview',
    notes: 'Bring portfolio',
  } as const;
  const interview: Interview = {
    ...formValue,
    id: 'interview-1',
    applicationId: 'application-1',
    createdAt: '2026-11-11T10:00:00.000Z',
    updatedAt: '2026-11-11T10:00:00.000Z',
  };
  let fixture: ComponentFixture<InterviewListComponent>;
  let http: HttpTestingController;
  let host: HTMLElement;
  let openDialog: jasmine.Spy<MatDialog['open']>;
  let closed: Subject<boolean>;

  function expectList(interviews: Interview[]): void {
    http.expectOne({ method: 'GET', url }).flush({
      success: true,
      data: { interviews },
      error: null,
      meta: {},
    });
    fixture.detectChanges();
  }

  function button(selector: string): HTMLButtonElement {
    const result = host.querySelector<HTMLButtonElement>(selector);
    if (!result) {
      throw new Error(`Button not found: ${selector}`);
    }

    return result;
  }

  beforeEach(async () => {
    closed = new Subject<boolean>();
    await TestBed.configureTestingModule({
      imports: [InterviewListComponent, NoopAnimationsModule],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(InterviewListComponent);
    openDialog = spyOn(fixture.debugElement.injector.get(MatDialog), 'open').and.returnValue(
      jasmine.createSpyObj('MatDialogRef', { afterClosed: closed.asObservable() }),
    );
    host = fixture.nativeElement as HTMLElement;
    fixture.componentRef.setInput('applicationId', 'application-1');
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('shows loading, handles a failed load, and retries to an empty state', () => {
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Loading interviews');
    http
      .expectOne({ method: 'GET', url })
      .flush(
        { success: false, error: { message: 'Could not load interviews.' } },
        { status: 500, statusText: 'Server error' },
      );
    fixture.detectChanges();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      'Could not load interviews.',
    );

    const heading = host.querySelector('h2');
    if (!heading) {
      throw new Error('Interviews heading not found');
    }
    const focusHeading = spyOn(heading, 'focus');
    button('.interviews__state button').click();
    fixture.detectChanges();
    expect(focusHeading).toHaveBeenCalled();
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Loading interviews');
    expectList([]);
    expect(host.textContent).toContain('No interviews yet.');
  });

  it('cancels a pending list request when the application changes', () => {
    const firstRequest = http.expectOne({ method: 'GET', url });
    fixture.componentRef.setInput('applicationId', 'application-2');
    fixture.detectChanges();

    expect(firstRequest.cancelled).toBeTrue();
    http
      .expectOne({
        method: 'GET',
        url: `${API_BASE_URL}/applications/application-2/interviews`,
      })
      .flush({
        success: true,
        data: {
          interviews: [
            { ...interview, applicationId: 'application-2', notes: 'Second application' },
          ],
        },
      });
    fixture.detectChanges();
    expect(host.textContent).toContain('Second application');
  });

  it('schedules an interview and displays its details after refreshing', () => {
    expectList([]);
    button('.interviews__header button').click();
    const data = openDialog.calls.mostRecent().args[1]?.data as InterviewFormDialogData;
    expect(data.interview).toBeUndefined();
    data.saveAction(formValue).subscribe(() => closed.next(true));
    const create = http.expectOne({ method: 'POST', url });
    expect(create.request.body).toEqual(formValue);
    create.flush({ success: true, data: { interview } });
    fixture.detectChanges();

    expectList([interview]);
    expect(host.textContent).toContain('Technical');
    expect(host.textContent).toContain('Scheduled');
    expect(host.textContent).toContain('45 min');
    expect(host.textContent).toContain('Bring portfolio');
    expect(host.querySelector('time')?.dateTime).toBe(interview.scheduledAt);
    expect(host.querySelector('a')?.href).toBe(formValue.meetingUrl);
  });

  it('passes the existing interview to the edit dialog and refreshes after saving', () => {
    expectList([interview]);
    button('button[aria-label^="Edit Technical"]').click();
    const data = openDialog.calls.mostRecent().args[1]?.data as InterviewFormDialogData;
    expect(data.interview).toEqual(interview);
    const payload = { ...formValue, status: 'completed' } as const;
    const updated = { ...interview, ...payload };
    data.saveAction(payload).subscribe(() => closed.next(true));
    const edit = http.expectOne({ method: 'PATCH', url: `${url}/${interview.id}` });
    expect(edit.request.body).toEqual(payload);
    edit.flush({ success: true, data: { interview: updated } });
    fixture.detectChanges();

    expectList([updated]);
    expect(host.textContent).toContain('Completed');
  });

  it('waits for confirmation before deleting and refreshes after success', () => {
    expectList([interview]);
    const deleteButton = button('button[aria-label^="Delete Technical"]');
    deleteButton.click();
    const detailUrl = `${url}/${interview.id}`;
    http.expectNone({ method: 'DELETE', url: detailUrl });
    const data = openDialog.calls.mostRecent().args[1]?.data as InterviewDeleteDialogData;
    data.deleteAction().subscribe(() => closed.next(true));
    http.expectOne({ method: 'DELETE', url: detailUrl }).flush({
      success: true,
      data: { deleted: true },
    });
    fixture.detectChanges();

    expectList([]);
    expect(host.textContent).toContain('No interviews yet.');
  });

  it('leaves the interview and list unchanged when deletion is cancelled', () => {
    expectList([interview]);
    button('button[aria-label^="Delete Technical"]').click();
    closed.next(false);
    fixture.detectChanges();

    http.expectNone(() => true);
    expect(host.textContent).toContain('Bring portfolio');
  });
});
