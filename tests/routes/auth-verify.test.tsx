import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { VerifyCode } from '@/routes/auth/VerifyCode';

describe('VerifyCode', () => {
  it('shows the target email and no demo hint', () => {
    render(<VerifyCode email="a@b.com" onSubmit={vi.fn()} onResend={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByText('a@b.com')).toBeInTheDocument();
    expect(screen.queryByText(/123456/)).not.toBeInTheDocument();
  });

  it('submits the joined 6-digit code', async () => {
    const onSubmit = vi.fn();
    render(<VerifyCode email="a@b.com" onSubmit={onSubmit} onResend={vi.fn()} onBack={vi.fn()} />);
    const boxes = screen.getAllByRole('textbox');
    for (let i = 0; i < 6; i++) await userEvent.type(boxes[i]!, String(i + 1));
    await userEvent.click(screen.getByRole('button', { name: 'Verify email' }));
    expect(onSubmit).toHaveBeenCalledWith('123456');
  });
});
