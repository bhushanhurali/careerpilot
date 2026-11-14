import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import { MatMenuHarness } from '@angular/material/menu/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { ThemeSwitcherComponent } from './theme-switcher.component';

describe('ThemeSwitcherComponent', () => {
  const key = 'careerpilot-theme';
  let previousPreference: string | null;
  let previousTheme: string | undefined;

  beforeEach(() => {
    previousPreference = localStorage.getItem(key);
    previousTheme = document.documentElement.dataset['theme'];
    document.documentElement.dataset['theme'] = 'system';
    TestBed.configureTestingModule({ imports: [ThemeSwitcherComponent, NoopAnimationsModule] });
  });

  afterEach(() => {
    if (previousPreference === null) localStorage.removeItem(key);
    else localStorage.setItem(key, previousPreference);
    if (previousTheme === undefined) delete document.documentElement.dataset['theme'];
    else document.documentElement.dataset['theme'] = previousTheme;
  });

  it('switches the document and overlay theme through the Material menu', async () => {
    const fixture = TestBed.createComponent(ThemeSwitcherComponent);
    const menu = await TestbedHarnessEnvironment.loader(fixture).getHarness(MatMenuHarness);
    await menu.open();
    expect(
      document.querySelector('[role="menuitemradio"][aria-checked="true"]')?.textContent,
    ).toContain('System');
    await menu.clickItem({ text: /Dark/ });
    expect(localStorage.getItem(key)).toBe('dark');
    expect(getComputedStyle(document.documentElement).colorScheme).toBe('dark');

    await menu.open();
    const item = document.querySelector('[role="menuitemradio"][aria-checked="true"]');
    expect(item?.textContent).toContain('Dark');
    if (!item) throw new Error('Expected selected dark item');
    expect(getComputedStyle(item).colorScheme).toBe('dark');
    await menu.clickItem({ text: /System/ });
    expect(getComputedStyle(document.documentElement).colorScheme).toBe('light dark');
    expect(localStorage.getItem(key)).toBe('system');
  });

  it('uses the operating system colors in System mode instead of the last explicit mode', async () => {
    const fixture = TestBed.createComponent(ThemeSwitcherComponent);
    const menu = await TestbedHarnessEnvironment.loader(fixture).getHarness(MatMenuHarness);
    const background = () => getComputedStyle(document.body).backgroundColor;
    const systemBackground = background();
    const prefersDark = matchMedia('(prefers-color-scheme: dark)').matches;
    await menu.open();
    await menu.clickItem({ text: prefersDark ? /Light/ : /Dark/ });
    expect(background()).not.toBe(systemBackground);
    await menu.open();
    await menu.clickItem({ text: /System/ });
    expect(background()).toBe(systemBackground);
  });
});
