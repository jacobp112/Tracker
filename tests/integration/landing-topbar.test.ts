import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync('landing/sections/topbar/topbar.html', 'utf8');

describe('landing topbar auth entry', () => {
  it('links Log in to the auth route', () => {
    expect(html).toMatch(/href="\/#\/auth"/);
    expect(html).toMatch(/Log in/);
  });
  it('links Sign up to the signup route', () => {
    expect(html).toMatch(/href="\/#\/auth\/signup"/);
    expect(html).toMatch(/Sign up/);
  });
});
