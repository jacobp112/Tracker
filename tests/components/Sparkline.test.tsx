import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Sparkline } from '@/components/Sparkline';

const data = [
  { value: 40, date: new Date('2026-07-01') },
  { value: 60, date: new Date('2026-07-02') },
];

describe('Sparkline — goal line is opt-in', () => {
  it('renders without a Goal label when no goal prop is given', () => {
    render(<Sparkline data={data} />);
    expect(screen.queryByText(/Goal/)).toBeNull();
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('renders the Goal label when a goal prop is given', () => {
    render(<Sparkline data={data} goal={70} />);
    expect(screen.getByText('Goal 70%')).toBeInTheDocument();
  });
});
