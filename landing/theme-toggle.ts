import { applyTheme, getInitialTheme, type Theme } from '@/theme/theme';

export function nextTheme(current: Theme): Theme {
  return current === 'dark' ? 'light' : 'dark';
}

export function setupThemeToggle(button: HTMLElement): void {
  button.addEventListener('click', () => {
    applyTheme(nextTheme(getInitialTheme()));
  });
}
