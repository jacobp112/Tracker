import { describe, it, expect, beforeEach } from 'vitest';
import { nextTheme, setupThemeToggle } from './theme-toggle';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('theme-toggle', () => {
  it('nextTheme flips the value', () => {
    expect(nextTheme('light')).toBe('dark');
    expect(nextTheme('dark')).toBe('light');
  });

  it('clicking the button flips data-theme and persists it', () => {
    document.documentElement.setAttribute('data-theme', 'light');
    const btn = document.createElement('button');
    setupThemeToggle(btn);
    btn.click();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('studyos-theme')).toBe('dark');
    btn.click();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
