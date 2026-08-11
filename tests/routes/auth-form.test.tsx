import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AuthForm } from '@/routes/auth/AuthForm';

function setup(mode: 'login' | 'signup' = 'login') {
  const props = {
    mode, onModeChange: vi.fn(), onSubmit: vi.fn(), onGoogle: vi.fn(),
    onMagicLink: vi.fn(), onForgot: vi.fn(),
  };
  render(<AuthForm {...props} />);
  return props;
}

describe('AuthForm', () => {
  it('shows the login headline and hides the Name field', () => {
    setup('login');
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
  });

  it('reveals the Name field and strength meter in signup', () => {
    setup('signup');
    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
  });

  it('blocks submit with an invalid email', async () => {
    const p = setup('login');
    await userEvent.type(screen.getByLabelText('Email'), 'nope');
    await userEvent.type(screen.getByLabelText('Password'), 'secret1');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(p.onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Enter a valid email')).toBeInTheDocument();
  });

  it('submits valid credentials', async () => {
    const p = setup('login');
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.com');
    await userEvent.type(screen.getByLabelText('Password'), 'secret1');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(p.onSubmit).toHaveBeenCalledWith({ name: '', email: 'a@b.com', password: 'secret1' });
  });

  it('renders only Google (no Apple) in the OAuth row', () => {
    setup('login');
    expect(screen.getByRole('button', { name: /Google/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Apple/ })).not.toBeInTheDocument();
  });
});
