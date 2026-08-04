import { describe, expect, it } from 'vitest';
import { parseHash } from '@/router';

describe('parseHash auth', () => {
  it('routes #/auth', () => expect(parseHash('#/auth')).toEqual({ name: 'auth', signup: false }));
  it('routes #/auth/signup', () => expect(parseHash('#/auth/signup')).toEqual({ name: 'auth', signup: true }));
});
