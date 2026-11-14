import { DOCUMENT, Injectable, inject, signal } from '@angular/core';

export type ThemePreference = 'light' | 'dark' | 'system';

const storageKey = 'careerpilot-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly selected = signal<ThemePreference>('system');
  readonly preference = this.selected.asReadonly();

  constructor() {
    const saved = this.document.documentElement.dataset['theme'];
    this.apply(saved === 'light' || saved === 'dark' ? saved : 'system');
  }

  setPreference(preference: ThemePreference): void {
    this.apply(preference);
    try {
      this.document.defaultView?.localStorage.setItem(storageKey, preference);
    } catch {
      // Appearance still works when browser storage is unavailable.
    }
  }

  private apply(preference: ThemePreference): void {
    this.document.documentElement.dataset['theme'] = preference;
    const hint = this.document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
    if (hint) hint.content = preference === 'system' ? 'light dark' : preference;
    this.selected.set(preference);
  }
}
