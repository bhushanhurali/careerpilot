/// <reference types="jasmine" />

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { CompanyFormComponent } from './company-form.component';

describe('CompanyFormComponent', () => {
  let fixture: ComponentFixture<CompanyFormComponent>;
  let component: CompanyFormComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompanyFormComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(CompanyFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('validates required, blank, and website fields', () => {
    componentApi().submit();

    expect(componentApi().form.controls.name.hasError('required')).toBeTrue();

    componentApi().form.controls.name.setValue('   ');
    componentApi().form.controls.website.setValue('not-a-url');

    expect(componentApi().form.controls.name.hasError('blank')).toBeTrue();
    expect(componentApi().form.controls.website.hasError('pattern')).toBeTrue();
  });

  it('emits trimmed values and converts empty optional fields to null', () => {
    const emittedValues: unknown[] = [];
    component.saveCompany.subscribe((value) => emittedValues.push(value));

    componentApi().form.setValue({
      name: ' Acme GmbH ',
      website: '',
      industry: ' Software ',
      location: '',
      notes: '',
    });
    componentApi().submit();

    expect(emittedValues[0]).toEqual({
      name: 'Acme GmbH',
      website: null,
      industry: 'Software',
      location: null,
      notes: null,
    });
  });

  it('shows duplicate-name errors and disables submit while saving', () => {
    fixture.componentRef.setInput('errorMessage', 'A company with this name already exists');
    fixture.componentRef.setInput('isSaving', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('A company with this name already exists');
    expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBeTrue();
  });

  function componentApi() {
    return component as unknown as {
      form: CompanyFormComponent['form'];
      submit: () => void;
    };
  }
});
