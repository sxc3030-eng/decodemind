import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DiffPreview } from '@/components/fixes/DiffPreview';

describe('DiffPreview', () => {
  it('renders add / remove / context lines', () => {
    render(
      <DiffPreview
        lines={[
          { type: 'context', oldLine: 1, newLine: 1, text: 'const x = 1;' },
          { type: 'remove', oldLine: 2, newLine: null, text: 'var y = 2;' },
          { type: 'add', oldLine: null, newLine: 2, text: 'const y = 2;' },
        ]}
      />,
    );
    expect(screen.getByText('const x = 1;')).toBeInTheDocument();
    expect(screen.getByText('var y = 2;')).toBeInTheDocument();
    expect(screen.getByText('const y = 2;')).toBeInTheDocument();
  });
});
