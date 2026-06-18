import { inject, provideAppInitializer } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { AuthStore } from './auth.store';

export function provideAuthInitializer() {
  return provideAppInitializer(() => firstValueFrom(inject(AuthStore).initialize()));
}
