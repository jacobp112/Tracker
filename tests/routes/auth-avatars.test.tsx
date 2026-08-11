import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AVATARS } from '@/routes/auth/avatars';

describe('avatars', () => {
  it('exposes exactly 6 avatar elements', () => {
    expect(AVATARS).toHaveLength(6);
    const { container } = render(<>{AVATARS}</>);
    expect(container.querySelectorAll('svg')).toHaveLength(6);
  });
});
