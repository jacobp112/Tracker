import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Welcome, WelcomeBack, MagicLinkSent, GoogleConnecting, Forgot } from '@/routes/auth/Outcome';

describe('Outcome screens', () => {
  it('Welcome greets by name and enters', async () => {
    const onEnter = vi.fn();
    render(<Welcome name="Ada" onEnter={onEnter} />);
    expect(screen.getByText(/Welcome, Ada/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Enter Cairn' }));
    expect(onEnter).toHaveBeenCalled();
  });

  it('WelcomeBack greets returning users', () => {
    render(<WelcomeBack name="Ada" onEnter={vi.fn()} />);
    expect(screen.getByText(/Welcome back, Ada/)).toBeInTheDocument();
  });

  it('MagicLinkSent shows the target email', () => {
    render(<MagicLinkSent email="a@b.com" onBack={vi.fn()} />);
    expect(screen.getByText('a@b.com')).toBeInTheDocument();
  });

  it('GoogleConnecting shows the connecting copy', () => {
    render(<GoogleConnecting />);
    expect(screen.getByText(/Connecting to Google/)).toBeInTheDocument();
  });

  it('Forgot validates then submits, and shows the sent state', async () => {
    const onSubmit = vi.fn();
    const { rerender } = render(<Forgot sent={false} sentEmail="" onSubmit={onSubmit} onBack={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(onSubmit).toHaveBeenCalledWith('a@b.com');
    rerender(<Forgot sent sentEmail="a@b.com" onSubmit={onSubmit} onBack={vi.fn()} />);
    expect(screen.getByText(/Trail marked/)).toBeInTheDocument();
  });
});
