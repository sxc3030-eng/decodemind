import { MODELS, type Tier } from '@/lib/llm/models';
import { formatBytes } from '@/lib/measurement/instrument';

export interface TierSelectionModalProps {
  open: boolean;
  recommendedTier: Tier | null;
  onSelect: (tier: Tier | 'skip') => void;
  onClose: () => void;
}

export function TierSelectionModal({ open, recommendedTier, onSelect, onClose }: TierSelectionModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-brand-card rounded-lg p-6 max-w-2xl w-full mx-4 space-y-4">
        <header>
          <h2 className="text-xl font-semibold">Choose a model tier</h2>
          <p className="text-sm text-brand-muted mt-1">
            DecodeMind translates linter findings to plain language using a model that runs
            <strong> entirely in your browser</strong>. The first time you load a tier it downloads
            the weights (cached for next time). Pick what fits your machine.
          </p>
        </header>

        <div className="grid gap-3">
          {(['quick', 'better', 'best'] as Tier[]).map((t) => {
            const m = MODELS[t];
            const recommended = recommendedTier === t;
            return (
              <button
                key={t}
                onClick={() => onSelect(t)}
                className={
                  'text-left p-4 rounded border-2 transition-colors ' +
                  (recommended
                    ? 'border-brand-accent bg-brand-surface'
                    : 'border-brand-muted hover:border-brand-accent bg-brand-surface')
                }
              >
                <div className="flex justify-between items-baseline">
                  <span className="font-semibold">{m.label}</span>
                  {recommended && (
                    <span className="text-xs text-brand-accent">Recommended for your machine</span>
                  )}
                </div>
                <div className="text-sm text-brand-muted mt-1">{m.recommendation}</div>
                <div className="text-xs text-brand-muted mt-2 font-mono">
                  ~{formatBytes(m.approxDiskBytes)} download · ~{formatBytes(m.approxVramBytes)} VRAM
                </div>
              </button>
            );
          })}

          <button
            onClick={() => onSelect('skip')}
            className="text-left p-4 rounded border-2 border-dashed border-brand-muted hover:border-brand-warn transition-colors"
          >
            <span className="font-semibold">Skip download — use built-in explanations</span>
            <div className="text-sm text-brand-muted mt-1">
              No model download. Findings show with the built-in dictionary (~30 rules covered).
              Best if you're on a tight network or just want to try DecodeMind.
            </div>
          </button>
        </div>

        <footer className="flex justify-end pt-2">
          <button onClick={onClose} className="text-sm text-brand-muted hover:text-white">
            Decide later
          </button>
        </footer>
      </div>
    </div>
  );
}
