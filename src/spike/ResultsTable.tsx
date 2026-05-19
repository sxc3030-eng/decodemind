import { formatBytes, formatDuration } from '@/lib/measurement/instrument';

export interface Measurement {
  label: string;
  durationMs?: number;
  bytes?: number;
  count?: number;
  note?: string;
}

export function ResultsTable({ measurements }: { measurements: Measurement[] }) {
  if (measurements.length === 0) {
    return <p className="text-brand-muted italic">No measurements yet.</p>;
  }
  return (
    <table className="w-full text-left text-sm font-mono border border-brand-card">
      <thead className="bg-brand-card">
        <tr>
          <th className="px-3 py-2">Measurement</th>
          <th className="px-3 py-2">Duration</th>
          <th className="px-3 py-2">Size</th>
          <th className="px-3 py-2">Count</th>
          <th className="px-3 py-2">Note</th>
        </tr>
      </thead>
      <tbody>
        {measurements.map((m, i) => (
          <tr key={i} className="border-t border-brand-card">
            <td className="px-3 py-2">{m.label}</td>
            <td className="px-3 py-2">{m.durationMs != null ? formatDuration(m.durationMs) : '—'}</td>
            <td className="px-3 py-2">{m.bytes != null ? formatBytes(m.bytes) : '—'}</td>
            <td className="px-3 py-2">{m.count != null ? String(m.count) : '—'}</td>
            <td className="px-3 py-2 text-brand-muted">{m.note ?? ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
