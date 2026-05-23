import type { Report, ReportFinding } from '@/lib/report/types';

const SARIF_VERSION = '2.1.0';
const SARIF_SCHEMA = 'https://schemastore.azurewebsites.net/schemas/json/sarif-2.1.0-rtm.5.json';

function severityToLevel(severity: ReportFinding['severity']): 'error' | 'warning' | 'note' {
  if (severity === 'info') return 'note';
  return severity;
}

export interface SarifLog {
  $schema: string;
  version: string;
  runs: SarifRun[];
}

export interface SarifRun {
  tool: { driver: { name: string; version: string; informationUri: string; rules: SarifRule[] } };
  results: SarifResult[];
}

export interface SarifRule {
  id: string;
  shortDescription: { text: string };
  helpUri?: string;
}

export interface SarifResult {
  ruleId: string;
  level: 'error' | 'warning' | 'note';
  message: { text: string };
  locations: {
    physicalLocation: {
      artifactLocation: { uri: string };
      region: { startLine: number; endLine?: number };
    };
  }[];
}

export function reportToSarif(report: Report, toolVersion = '0.0.1'): SarifLog {
  // Build a unique-rules map
  const rules = new Map<string, SarifRule>();
  for (const f of report.findings) {
    const id = f.ruleId ?? 'unknown';
    if (!rules.has(id)) {
      rules.set(id, { id, shortDescription: { text: f.message } });
    }
  }

  const results: SarifResult[] = report.findings.map((f) => ({
    ruleId: f.ruleId ?? 'unknown',
    level: severityToLevel(f.severity),
    message: { text: f.message },
    locations: [
      {
        physicalLocation: {
          artifactLocation: { uri: f.file },
          region: { startLine: f.line ?? 1 },
        },
      },
    ],
  }));

  return {
    $schema: SARIF_SCHEMA,
    version: SARIF_VERSION,
    runs: [
      {
        tool: {
          driver: {
            name: 'DecodeMind',
            version: toolVersion,
            informationUri: 'https://decodemind.dev',
            rules: Array.from(rules.values()),
          },
        },
        results,
      },
    ],
  };
}
