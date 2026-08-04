import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Onboarding } from '@/routes/auth/Onboarding';

describe('Onboarding', () => {
  it('finishes with the chosen avatar and name', async () => {
    const onFinish = vi.fn();
    render(<Onboarding onFinish={onFinish} />);
    const avatarButtons = screen.getAllByRole('button').filter((b) => b.querySelector('svg'));
    await userEvent.click(avatarButtons[2]!);
    await userEvent.type(screen.getByLabelText('Display name'), 'Ada');
    await userEvent.click(screen.getByRole('button', { name: 'Finish setup' }));
    expect(onFinish).toHaveBeenCalledWith({ avatarIndex: 2, displayName: 'Ada' });
  });
});
