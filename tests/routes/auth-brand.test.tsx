import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BrandPanel } from '@/routes/auth/BrandPanel';

/**
 * BrandPanel hosts the animated Cairn mascot. The animation starts from a
 * useEffect (startCairnAnimation) and tears down on unmount; these tests verify
 * the panel renders the mascot and the copy, and that mounting/unmounting the
 * animation is side-effect-safe under jsdom.
 */
describe('BrandPanel', () => {
  it('renders the headline, tagline, and the animated mascot', () => {
    render(<BrandPanel />);
    expect(screen.getByText('stone')).toBeInTheDocument();
    expect(
      screen.getByText(/one place that doesn't wobble/),
    ).toBeInTheDocument();
    // role=img + aria-labelledby the mascot's <title>
    expect(
      screen.getByRole('img', { name: /wobbling stack of stones/i }),
    ).toBeInTheDocument();
  });

  it('mounts and unmounts the animation without throwing', () => {
    const { unmount } = render(<BrandPanel />);
    // The animated segments the loop drives are present in the DOM.
    expect(document.querySelector('#cairn-head')).not.toBeNull();
    expect(document.querySelector('#cairn-seg1')).not.toBeNull();
    expect(() => unmount()).not.toThrow();
  });
});
