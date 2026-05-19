import type { DiffLine } from '@/lib/fixes/applyEdit';

const LINE_STYLES = {
  context: 'bg-transparent text-brand-muted',
  add: 'bg-emerald-900/30 text-emerald-200',
  remove: 'bg-red-900/30 text-red-200',
};

export function DiffPreview({ lines }: { lines: DiffLine[] }) {
  return (
    <pre className="text-xs font-mono bg-brand-surface rounded p-3 overflow-x-auto">
      {lines.map((line, i) => (
        <div key={i} className={`${LINE_STYLES[line.type]} px-2`}>
          <span className="inline-block w-8 text-right pr-2 select-none opacity-50">
            {line.oldLine ?? line.newLine ?? ''}
          </span>
          <span className="inline-block w-3 select-none">
            {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
          </span>
          <span>{line.text}</span>
        </div>
      ))}
    </pre>
  );
}
