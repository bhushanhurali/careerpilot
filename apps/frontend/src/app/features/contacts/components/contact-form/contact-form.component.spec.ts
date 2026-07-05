/// <reference types="jasmine" />

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { ContactFormComponent } from './contact-form.component';

describe('ContactFormComponent', () => {
  let fixture: ComponentFixture<ContactFormComponent>;
  let component: ContactFormComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContactFormComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('validates required, blank, email, and LinkedIn URL fields', () => {
    componentApi().submit();

    expect(componentApi().form.controls.firstName.hasError('required')).toBeTrue();

    componentApi().form.controls.firstName.setValue('   ');
    componentApi().form.controls.email.setValue('not-email');
    componentApi().form.controls.linkedInUrl.setValue('not-a-url');

    expect(componentApi().form.controls.firstName.hasError('blank')).toBeTrue();
    expect(componentApi().form.controls.email.hasError('email')).toBeTrue();
    expect(componentApi().form.controls.linkedInUrl.hasError('pattern')).toBeTrue();
  });

  it('emits trimmed values and converts empty optional fields to null', () => {
    const emittedValues: unknown[] = [];
    component.saveContact.subscribe((value) => emittedValues.push(value));

    componentApi().form.setValue({
      firstName: ' Ada ',
      lastName: '',
      email: 'ada@example.com',
      phone: '',
      roleTitle: ' Recruiter ',
      linkedInUrl: '',
      notes: '',
    });
    componentApi().submit();

    expect(emittedValues[0]).toEqual({
      firstName: 'Ada',
      lastName: null,
      email: 'ada@example.com',
      phone: null,
      roleTitle: 'Recruiter',
      linkedInUrl: null,
      notes: null,
    });
  });

  it('shows backend errors and disables submit while saving', () => {
    fixture.componentRef.setInput('errorMessage', 'Validation failed');
    fixture.componentRef.setInput('isSaving', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Validation failed');
    expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBeTrue();
  });

  function componentApi() {
    return component as unknown as {
      form: ContactFormComponent['form'];
      submit: () => void;
    };
  }
});
