import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TierSelectionModal } from '@/components/TierSelectionModal';

describe('TierSelectionModal', () => {
  it('renders the three tiers + skip option when open', () => {
    render(
      <TierSelectionModal
        open
        recommendedTier="quick"
        onSelect={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText(/Quick \(1\.5B\)/)).toBeInTheDocument();
    expect(screen.getByText(/Better \(3B\)/)).toBeInTheDocument();
    expect(screen.getByText(/Best \(7B\)/)).toBeInTheDocument();
    expect(screen.getByText(/Skip download/)).toBeInTheDocument();
  });

  it('returns null when closed', () => {
    const { container } = render(
      <TierSelectionModal
        open={false}
        recommendedTier={null}
        onSelect={() => {}}
        onClose={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('calls onSelect with the chosen tier', () => {
    const onSelect = vi.fn();
    render(
      <TierSelectionModal
        open
        recommendedTier="quick"
        onSelect={onSelect}
        onClose={() => {}}
      />,
    );
    fireEvent.click(screen.getByText(/Quick \(1\.5B\)/));
    expect(onSelect).toHaveBeenCalledWith('quick');
  });

  it('calls onSelect("skip") when skip option chosen', () => {
    const onSelect = vi.fn();
    render(
      <TierSelectionModal
        open
        recommendedTier="quick"
        onSelect={onSelect}
        onClose={() => {}}
      />,
    );
    fireEvent.click(screen.getByText(/Skip download/));
    expect(onSelect).toHaveBeenCalledWith('skip');
  });
});
