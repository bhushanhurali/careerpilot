import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, shareReplay, timeout } from 'rxjs';

import { API_BASE_URL } from '../config/api.config';
import { SKIP_AUTH } from './auth-http-context';
import { ApiResponse } from './auth.models';

@Injectable({ providedIn: 'root' })
export class RegistrationPolicyService {
  readonly status$ = inject(HttpClient)
    .get<ApiResponse<{ registrationEnabled: boolean }>>(`${API_BASE_URL}/auth/registration`, {
      context: new HttpContext().set(SKIP_AUTH, true),
    })
    .pipe(
      timeout(3000),
      map((response) => response.success && response.data?.registrationEnabled === true),
      catchError(() => of(false)),
      shareReplay(1),
    );

  readonly enabled = toSignal(this.status$, { initialValue: false });
}
