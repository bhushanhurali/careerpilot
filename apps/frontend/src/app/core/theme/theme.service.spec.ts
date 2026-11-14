import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let root: HTMLElement;
  let storage: jasmine.SpyObj<Storage>;

  beforeEach(() => {
    root = document.createElement('html');
    storage = jasmine.createSpyObj<Storage>('Storage', ['setItem']);
    TestBed.configureTestingModule({
      providers: [
        {
          provide: DOCUMENT,
          useValue: { documentElement: root, defaultView: { localStorage: storage } },
        },
      ],
    });
  });

  it('retains the preference resolved before Angular bootstraps', () => {
    root.dataset['theme'] = 'dark';
    const theme = TestBed.inject(ThemeService);
    expect(theme.preference()).toBe('dark');
    expect(root.dataset['theme']).toBe('dark');
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('falls back to System and persists each explicit choice', () => {
    root.dataset['theme'] = 'invalid';
    const theme = TestBed.inject(ThemeService);
    expect(theme.preference()).toBe('system');
    for (const preference of ['light', 'dark', 'system'] as const) {
      theme.setPreference(preference);
      expect(theme.preference()).toBe(preference);
      expect(root.dataset['theme']).toBe(preference);
      expect(storage.setItem).toHaveBeenCalledWith('careerpilot-theme', preference);
    }
  });

  it('applies the selection even when persistence fails', () => {
    storage.setItem.and.throwError('Storage unavailable');
    const theme = TestBed.inject(ThemeService);
    theme.setPreference('dark');
    expect(root.dataset['theme']).toBe('dark');
  });
});
