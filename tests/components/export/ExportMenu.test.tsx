import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExportMenu } from '@/components/export/ExportMenu';
import type { Report } from '@/lib/report/types';

describe('ExportMenu', () => {
  it('shows empty state when no findings', () => {
    const empty: Report = { findings: [], filesScanned: 0, totalFiles: 0, elapsedMs: 0, warnings: [], noiseScore: 0 };
    render(<ExportMenu report={empty} />);
    expect(screen.getByText(/Nothing to export/)).toBeInTheDocument();
  });

  it('shows 4 export buttons when findings present', () => {
    const report: Report = {
      findings: [
        { file: 'a.py', line: 1, severity: 'error', ruleId: 'r', category: 'security', message: 'm' },
      ],
      filesScanned: 1, totalFiles: 1, elapsedMs: 100, warnings: [], noiseScore: 0,
    };
    render(<ExportMenu report={report} />);
    expect(screen.getByText('Export PDF')).toBeInTheDocument();
    expect(screen.getByText('Export SARIF')).toBeInTheDocument();
    expect(screen.getByText('Export Markdown')).toBeInTheDocument();
    expect(screen.getByText('Copy summary')).toBeInTheDocument();
  });
});
