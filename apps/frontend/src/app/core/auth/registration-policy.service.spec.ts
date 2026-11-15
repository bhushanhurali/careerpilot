import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { API_BASE_URL } from '../config/api.config';
import { SKIP_AUTH } from './auth-http-context';
import { RegistrationPolicyService } from './registration-policy.service';

describe('RegistrationPolicyService', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }),
  );

  it('shares one public request and enables signup only after an explicit opt-in', () => {
    const policy = TestBed.inject(RegistrationPolicyService);
    const http = TestBed.inject(HttpTestingController);
    expect(policy.enabled()).toBeFalse();
    policy.status$.subscribe();
    const request = http.expectOne(`${API_BASE_URL}/auth/registration`);
    expect(request.request.context.get(SKIP_AUTH)).toBeTrue();
    request.flush({ success: true, data: { registrationEnabled: true } });
    expect(policy.enabled()).toBeTrue();
    http.verify();
  });

  it('fails closed when the API is unavailable', () => {
    const policy = TestBed.inject(RegistrationPolicyService);
    const http = TestBed.inject(HttpTestingController);
    http
      .expectOne(`${API_BASE_URL}/auth/registration`)
      .flush(null, { status: 503, statusText: 'Unavailable' });
    expect(policy.enabled()).toBeFalse();
    http.verify();
  });
});
