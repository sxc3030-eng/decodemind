import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SectionedReport } from '@/components/report/SectionedReport';
import type { Report } from '@/lib/report/types';

const sampleReport: Report = {
  findings: [
    {
      file: 'src/server.py',
      line: 42,
      severity: 'error',
      ruleId: 'injection-shell-true',
      category: 'security',
      message: 'Shell injection risk',
    },
    {
      file: 'src/index.ts',
      line: 10,
      severity: 'warning',
      ruleId: 'no-undef',
      category: 'bug',
      message: 'undefined variable',
    },
    {
      file: 'src/style.css',
      line: 5,
      severity: 'info',
      ruleId: 'E501',
      category: 'quality',
      message: 'Line too long',
    },
  ],
  filesScanned: 3,
  totalFiles: 3,
  elapsedMs: 1234,
  warnings: [],
  noiseScore: 1 / 3,
};

describe('SectionedReport', () => {
  it('renders all 4 category sections', () => {
    render(<SectionedReport report={sampleReport} />);
    expect(screen.getByText(/Security/)).toBeInTheDocument();
    expect(screen.getByText(/Bugs/)).toBeInTheDocument();
    expect(screen.getByText(/Logic/)).toBeInTheDocument();
    expect(screen.getByText(/Quality/)).toBeInTheDocument();
  });

  it('shows summary line with finding counts', () => {
    render(<SectionedReport report={sampleReport} />);
    expect(screen.getByText(/3 findings/)).toBeInTheDocument();
    expect(screen.getByText(/2 actionable/)).toBeInTheDocument();
  });

  it('shows security findings expanded by default', () => {
    render(<SectionedReport report={sampleReport} />);
    expect(screen.getByText(/Shell injection risk/)).toBeInTheDocument();
  });

  it('shows noise-warning callout when noise >= 60%', () => {
    const noisy: Report = {
      ...sampleReport,
      findings: Array.from({ length: 10 }, (_, i) => ({
        file: `s${i}.py`,
        line: 1,
        severity: 'info' as const,
        ruleId: 'E501',
        category: 'quality' as const,
        message: 'noise',
      })),
      noiseScore: 1,
    };
    render(<SectionedReport report={noisy} />);
    expect(screen.getByText(/Most findings are style/)).toBeInTheDocument();
  });

  it('does NOT show noise-warning when noise < 60%', () => {
    render(<SectionedReport report={sampleReport} />);
    expect(screen.queryByText(/Most findings are style/)).not.toBeInTheDocument();
  });

  it('shows scan-warnings list when warnings are present', () => {
    const reportWithWarnings: Report = {
      ...sampleReport,
      warnings: ['Loaded 3 patterns from .decodemind-ignore'],
    };
    render(<SectionedReport report={reportWithWarnings} />);
    expect(screen.getByText(/Loaded 3 patterns/)).toBeInTheDocument();
  });
});
